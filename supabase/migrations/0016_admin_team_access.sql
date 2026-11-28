-- 0016 T-14 ADM-4 + Muse A1/A2.
-- Team and branch Orders identities, branch-scoped Manager access, paged customer directory,
-- and customer anonymization. All writes are Admin-only and audited.
begin;

do $preflight$
begin
  if to_regclass('public.profiles') is null
     or to_regclass('public.user_roles') is null
     or to_regclass('public.staff_branch_access') is null
     or to_regclass('public.branches') is null
     or to_regclass('public.memberships') is null
     or to_regclass('public.points_ledger') is null
     or to_regprocedure('public.azal_is_admin()') is null
     or to_regprocedure('public.azal_admin_customer_directory()') is null
     or to_regclass('auth.users') is null
     or to_regclass('auth.identities') is null then
    raise exception '0016 requires the accepted T-08 schema, 0013/0014 and Supabase Auth';
  end if;
end;
$preflight$;

alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check
  check (role in ('customer','staff','admin','manager'));

alter table public.profiles
  add column if not exists member_number_retired boolean not null default false;

create index if not exists profiles_directory_name_idx on public.profiles (lower(display_name));
create index if not exists profiles_directory_phone_idx on public.profiles (lower(phone));
create index if not exists profiles_directory_member_number_idx on public.profiles (member_number);

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check (char_length(action) between 1 and 80),
  target_type text not null check (char_length(target_type) between 1 and 40),
  target_id text,
  branch_slug text references public.branches(slug) on delete restrict,
  reason text,
  request_id uuid not null default gen_random_uuid(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (request_id)
);
create index if not exists admin_audit_target_created_idx
  on public.admin_audit_log (target_type, target_id, created_at desc, id desc);
create index if not exists admin_audit_actor_created_idx
  on public.admin_audit_log (actor_user_id, created_at desc, id desc);

create or replace function public.azal_reject_admin_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  raise exception 'admin_audit_log_is_append_only' using errcode='42501';
end;
$fn$;
revoke all on function public.azal_reject_admin_audit_mutation() from public, anon, authenticated;
drop trigger if exists admin_audit_log_no_update_delete on public.admin_audit_log;
create trigger admin_audit_log_no_update_delete
  before update or delete on public.admin_audit_log
  for each row execute function public.azal_reject_admin_audit_mutation();
alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from public, anon, authenticated;

create table if not exists public.admin_team_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  display_name text not null,
  role text not null check (role in ('manager','staff')),
  branch_slugs text[] not null check (cardinality(branch_slugs) > 0),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  accepted_user_id uuid references public.profiles(id) on delete restrict,
  accepted_at timestamptz,
  revoked_at timestamptz,
  check ((accepted_user_id is null) = (accepted_at is null))
);
create unique index if not exists admin_team_invites_pending_email_idx
  on public.admin_team_invites (lower(email))
  where accepted_at is null and revoked_at is null;
alter table public.admin_team_invites enable row level security;
revoke all on public.admin_team_invites from public, anon, authenticated;

create table if not exists public.branch_orders_accounts (
  branch_slug text primary key references public.branches(slug) on delete restrict,
  auth_user_id uuid not null unique references public.profiles(id) on delete restrict,
  login_email text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.branch_orders_accounts enable row level security;
revoke all on public.branch_orders_accounts from public, anon, authenticated;

create or replace function public.azal_is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select auth.uid() is not null and exists (
    select 1 from public.user_roles r
    where r.user_id = auth.uid() and r.role = 'manager'
  );
$fn$;

create or replace function public.azal_manager_can_access(p_branch_slug text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select auth.uid() is not null and exists (
    select 1
    from public.user_roles r
    join public.staff_branch_access a on a.user_id = r.user_id
    where r.user_id = auth.uid()
      and r.role = 'manager'
      and a.branch_slug = p_branch_slug
  );
$fn$;
revoke all on function public.azal_is_manager() from public, anon;
revoke all on function public.azal_manager_can_access(text) from public, anon;
grant execute on function public.azal_is_manager() to authenticated;
grant execute on function public.azal_manager_can_access(text) to authenticated;

-- Staff kitchen branch picker: only Admin's active branches or the caller's assigned Staff branches.
-- Manager roles are deliberately excluded; they use the separate, redacted Manager RPC.
create or replace function public.azal_staff_my_branches()
returns text[]
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce(pg_catalog.array_agg(b.slug order by b.name_en,b.slug),array[]::text[])
  from public.branches b
  where b.active and (
    public.azal_is_admin()
    or exists (
      select 1 from public.user_roles r
      join public.staff_branch_access a on a.user_id=r.user_id
      where r.user_id=auth.uid() and r.role='staff' and a.branch_slug=b.slug
    )
  );
$fn$;
revoke all on function public.azal_staff_my_branches() from public, anon;
grant execute on function public.azal_staff_my_branches() to authenticated;

-- A1: true server-side search + pagination. Balance and membership data are aggregated
-- only for the selected page; the response never materializes the full directory in the browser.
create or replace function public.azal_admin_customer_directory_page(
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_term text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_search, '')));
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 100));
  v_offset integer := greatest(0, least(coalesce(p_offset, 0), 100000));
  v_total bigint;
  v_rows jsonb;
begin
  if auth.uid() is null or not public.azal_is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;

  with filtered as (
    select p.id as user_id, p.display_name, p.phone, u.email::text as email,
           p.member_number, p.created_at, m.status as membership_status, m.joined_at
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.memberships m on m.user_id = p.id
    where p.anonymized_at is null
      and not p.member_number_retired
      and not exists (
        select 1 from public.user_roles r
        where r.user_id = p.id and r.role in ('admin','staff','manager')
      )
      and (
        v_term = ''
        or pg_catalog.strpos(pg_catalog.lower(coalesce(p.display_name,'')), v_term) > 0
        or pg_catalog.strpos(pg_catalog.lower(coalesce(p.phone,'')), v_term) > 0
        or pg_catalog.strpos(pg_catalog.lower(coalesce(u.email,'')), v_term) > 0
        or pg_catalog.strpos(coalesce(p.member_number::text,''), v_term) > 0
      )
  ),
  page as (
    select * from filtered
    order by created_at desc, user_id desc
    limit v_limit offset v_offset
  ),
  enriched as (
    select page.*,
      coalesce((select pg_catalog.sum(l.delta_points)::bigint
                from public.points_ledger l where l.user_id = page.user_id), 0) as balance
    from page
  )
  select (select count(*) from filtered),
         coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(enriched)) from enriched), '[]'::jsonb)
    into v_total, v_rows;

  return pg_catalog.jsonb_build_object('total', v_total, 'rows', v_rows, 'limit', v_limit, 'offset', v_offset);
end;
$fn$;
revoke all on function public.azal_admin_customer_directory_page(text,integer,integer) from public, anon, authenticated;
grant execute on function public.azal_admin_customer_directory_page(text,integer,integer) to authenticated;

-- Single-customer contact lookup for an Admin opening one order detail.
-- Avoids pulling the entire customer directory into the all-status order list.
create or replace function public.azal_admin_customer_contact(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare v_contact jsonb;
begin
  if auth.uid() is null or not public.azal_is_admin() then raise exception 'not_admin' using errcode='42501'; end if;
  select pg_catalog.jsonb_build_object(
    'user_id',p.id,'display_name',p.display_name,'phone',p.phone,
    'member_number',p.member_number,'email',u.email
  ) into v_contact
  from public.profiles p join auth.users u on u.id=p.id
  where p.id=p_user_id and p.anonymized_at is null and not p.member_number_retired
    and not exists(select 1 from public.user_roles r where r.user_id=p.id and r.role in ('admin','staff','manager'));
  return v_contact;
end;
$fn$;
revoke all on function public.azal_admin_customer_contact(uuid) from public, anon, authenticated;
grant execute on function public.azal_admin_customer_contact(uuid) to authenticated;

-- Admin-only Team directory; it returns only named team identities and pending in-portal invites.
create or replace function public.azal_admin_team_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare v_members jsonb; v_invites jsonb; v_branches jsonb; v_orders jsonb;
begin
  if auth.uid() is null or not public.azal_is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  select coalesce(pg_catalog.jsonb_agg(x.member order by x.email), '[]'::jsonb)
    into v_members
  from (
    select u.email,
      pg_catalog.jsonb_build_object(
        'user_id', p.id, 'name', coalesce(p.display_name, u.email), 'email', u.email,
        'roles', (select pg_catalog.jsonb_agg(r.role order by r.role) from public.user_roles r where r.user_id=p.id and r.role in ('admin','manager','staff')),
        'branches', (select coalesce(pg_catalog.jsonb_agg(a.branch_slug order by a.branch_slug),'[]'::jsonb) from public.staff_branch_access a where a.user_id=p.id),
        'last_sign_in_at', u.last_sign_in_at,
        'is_orders_account', exists(select 1 from public.branch_orders_accounts oa where oa.auth_user_id=p.id)
      ) as member
    from public.profiles p join auth.users u on u.id=p.id
    where exists(select 1 from public.user_roles r where r.user_id=p.id and r.role in ('admin','manager','staff'))
       or exists(select 1 from public.branch_orders_accounts oa where oa.auth_user_id=p.id)
  ) x;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id',i.id,'email',i.email,'name',i.display_name,'role',i.role,'branches',i.branch_slugs,'expires_at',i.expires_at
  ) order by i.created_at desc),'[]'::jsonb)
    into v_invites
  from public.admin_team_invites i
  where i.accepted_at is null and i.revoked_at is null and i.expires_at > pg_catalog.now();
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('slug',b.slug,'name',b.name_en) order by b.name_en),'[]'::jsonb)
    into v_branches from public.branches b where b.active;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('branch_slug',o.branch_slug,'email',o.login_email,'user_id',o.auth_user_id) order by o.branch_slug),'[]'::jsonb)
    into v_orders from public.branch_orders_accounts o;
  return pg_catalog.jsonb_build_object('members',v_members,'invites',v_invites,'branches',v_branches,'orders_accounts',v_orders);
end;
$fn$;
revoke all on function public.azal_admin_team_list() from public, anon, authenticated;
grant execute on function public.azal_admin_team_list() to authenticated;

-- Assign an existing, email-verified account, or record a pending in-portal invite.
-- A6: this function sends no email. A pending invite is applied only after that email signs up
-- and becomes verified through the existing Auth flow.
create or replace function public.azal_admin_team_assign(
  p_email text,
  p_display_name text,
  p_role text,
  p_branch_slugs text[],
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid uuid; v_confirmed timestamptz; v_email text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_email,'')));
  v_name text := pg_catalog.btrim(coalesce(p_display_name,''));
  v_branches text[] := coalesce(p_branch_slugs, array[]::text[]);
  v_invite uuid;
  v_branch text;
begin
  if auth.uid() is null or not public.azal_is_admin() then raise exception 'not_admin' using errcode='42501'; end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or pg_catalog.char_length(v_email)>254 then raise exception 'invalid_email'; end if;
  if v_name='' or pg_catalog.char_length(v_name)>80 then raise exception 'invalid_name'; end if;
  if p_role is null or p_role not in ('admin','manager','staff') then raise exception 'invalid_role'; end if;
  if p_role='admin' and cardinality(v_branches)<>0 then raise exception 'admin_has_no_branch_scope'; end if;
  if p_role in ('manager','staff') and cardinality(v_branches)=0 then raise exception 'branch_required'; end if;
  foreach v_branch in array v_branches loop
    if not exists(select 1 from public.branches b where b.slug=v_branch and b.active) then raise exception 'invalid_branch'; end if;
  end loop;

  select u.id,u.email_confirmed_at into v_uid,v_confirmed
  from auth.users u where pg_catalog.lower(u.email)=v_email limit 1;

  if v_uid is null or v_confirmed is null then
    if p_role='admin' then raise exception 'new_admin_requires_existing_verified_account'; end if;
    insert into public.admin_team_invites(email,display_name,role,branch_slugs,created_by)
    values(v_email,v_name,p_role,v_branches,auth.uid())
    on conflict (lower(email)) where accepted_at is null and revoked_at is null
    do update set display_name=excluded.display_name,role=excluded.role,branch_slugs=excluded.branch_slugs,
                  created_by=excluded.created_by,created_at=pg_catalog.now(),expires_at=pg_catalog.now()+interval '30 days'
    returning id into v_invite;
    insert into public.admin_audit_log(actor_user_id,action,target_type,target_id,reason,metadata)
    values(auth.uid(),'team_invite_recorded','email',v_email,coalesce(nullif(pg_catalog.btrim(p_reason),''),'Team access prepared; no email sent'),
           pg_catalog.jsonb_build_object('role',p_role,'branches',v_branches));
    return pg_catalog.jsonb_build_object('status','pending_account','invite_id',v_invite);
  end if;

  if exists(select 1 from public.profiles p where p.id=v_uid and p.anonymized_at is not null) then raise exception 'account_anonymized'; end if;
  if exists(select 1 from public.user_roles r where r.user_id=v_uid and r.role='admin') and p_role<>'admin' then
    raise exception 'admin_cannot_be_demoted';
  end if;
  if exists(select 1 from public.branch_orders_accounts oa where oa.auth_user_id=v_uid) then raise exception 'orders_account_managed_separately'; end if;

  delete from public.user_roles where user_id=v_uid and role in ('staff','manager');
  delete from public.staff_branch_access where user_id=v_uid;
  insert into public.user_roles(user_id,role) values(v_uid,p_role) on conflict do nothing;
  if p_role in ('manager','staff') then
    insert into public.staff_branch_access(user_id,branch_slug)
    select v_uid,branch_slug from pg_catalog.unnest(v_branches) as branches(branch_slug) on conflict do nothing;
  end if;
  update public.profiles set display_name=v_name where id=v_uid;
  insert into public.admin_audit_log(actor_user_id,action,target_type,target_id,reason,metadata)
  values(auth.uid(),'team_access_granted','user',v_uid::text,coalesce(nullif(pg_catalog.btrim(p_reason),''),'Team access granted by Admin'),
         pg_catalog.jsonb_build_object('role',p_role,'branches',v_branches));
  return pg_catalog.jsonb_build_object('status','assigned','user_id',v_uid);
end;
$fn$;
revoke all on function public.azal_admin_team_assign(text,text,text,text[],text) from public, anon, authenticated;
grant execute on function public.azal_admin_team_assign(text,text,text,text[],text) to authenticated;

create or replace function public.azal_admin_team_remove(p_user_id uuid,p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_roles text[];
begin
  if auth.uid() is null or not public.azal_is_admin() then raise exception 'not_admin' using errcode='42501'; end if;
  if p_user_id is null or pg_catalog.btrim(coalesce(p_reason,''))='' then raise exception 'reason_required'; end if;
  if p_user_id=auth.uid() then raise exception 'root_admin_protected'; end if;
  if exists(select 1 from public.user_roles r where r.user_id=p_user_id and r.role='admin') then raise exception 'admin_role_protected'; end if;
  if exists(select 1 from public.branch_orders_accounts oa where oa.auth_user_id=p_user_id) then raise exception 'orders_account_managed_separately'; end if;
  select pg_catalog.array_agg(r.role) into v_roles from public.user_roles r where r.user_id=p_user_id and r.role in ('manager','staff');
  if v_roles is null then raise exception 'team_member_not_found'; end if;
  delete from public.user_roles where user_id=p_user_id and role in ('manager','staff');
  delete from public.staff_branch_access where user_id=p_user_id;
  insert into public.admin_audit_log(actor_user_id,action,target_type,target_id,reason,metadata)
  values(auth.uid(),'team_access_revoked','user',p_user_id::text,pg_catalog.btrim(p_reason),pg_catalog.jsonb_build_object('removed_roles',v_roles));
  return pg_catalog.jsonb_build_object('status','revoked','user_id',p_user_id);
end;
$fn$;
revoke all on function public.azal_admin_team_remove(uuid,text) from public, anon, authenticated;
grant execute on function public.azal_admin_team_remove(uuid,text) to authenticated;

create or replace function public.azal_admin_team_invite_revoke(p_invite_id uuid,p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_email text;
begin
  if auth.uid() is null or not public.azal_is_admin() then raise exception 'not_admin' using errcode='42501'; end if;
  if p_invite_id is null or pg_catalog.btrim(coalesce(p_reason,''))='' then raise exception 'reason_required'; end if;
  update public.admin_team_invites
     set revoked_at=pg_catalog.now()
   where id=p_invite_id and accepted_at is null and revoked_at is null and expires_at>pg_catalog.now()
   returning email into v_email;
  if v_email is null then raise exception 'pending_invite_not_found'; end if;
  insert into public.admin_audit_log(actor_user_id,action,target_type,target_id,reason)
  values(auth.uid(),'team_invite_revoked','invite',p_invite_id::text,pg_catalog.btrim(p_reason));
  return pg_catalog.jsonb_build_object('status','revoked','invite_id',p_invite_id);
end;
$fn$;
revoke all on function public.azal_admin_team_invite_revoke(uuid,text) from public, anon, authenticated;
grant execute on function public.azal_admin_team_invite_revoke(uuid,text) to authenticated;

create or replace function public.azal_admin_link_orders_account(p_branch_slug text,p_user_id uuid,p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if auth.uid() is null or not public.azal_is_admin() then raise exception 'not_admin' using errcode='42501'; end if;
  if not exists(select 1 from public.branches b where b.slug=p_branch_slug and b.active) then raise exception 'invalid_branch'; end if;
  if not exists(select 1 from auth.users u where u.id=p_user_id and pg_catalog.lower(u.email)=pg_catalog.lower(p_email)) then raise exception 'orders_auth_identity_mismatch'; end if;
  if exists(select 1 from public.branch_orders_accounts where branch_slug=p_branch_slug or auth_user_id=p_user_id) then raise exception 'orders_account_exists'; end if;
  insert into public.user_roles(user_id,role) values(p_user_id,'staff') on conflict do nothing;
  insert into public.staff_branch_access(user_id,branch_slug) values(p_user_id,p_branch_slug) on conflict do nothing;
  insert into public.branch_orders_accounts(branch_slug,auth_user_id,login_email) values(p_branch_slug,p_user_id,pg_catalog.lower(p_email));
  insert into public.admin_audit_log(actor_user_id,action,target_type,target_id,branch_slug,reason,metadata)
  values(auth.uid(),'orders_account_provisioned','branch',p_branch_slug,p_branch_slug,'Branch Orders identity provisioned',
         pg_catalog.jsonb_build_object('auth_user_id',p_user_id));
  return pg_catalog.jsonb_build_object('status','linked','branch_slug',p_branch_slug,'user_id',p_user_id,'email',pg_catalog.lower(p_email));
end;
$fn$;
revoke all on function public.azal_admin_link_orders_account(text,uuid,text) from public, anon, authenticated;
grant execute on function public.azal_admin_link_orders_account(text,uuid,text) to authenticated;

create or replace function public.azal_admin_orders_password_audit(p_branch_slug text,p_phase text,p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if auth.uid() is null or not public.azal_is_admin() then raise exception 'not_admin' using errcode='42501'; end if;
  if p_phase not in ('requested','completed','failed') or pg_catalog.btrim(coalesce(p_reason,''))='' then raise exception 'invalid_audit'; end if;
  if not exists(select 1 from public.branch_orders_accounts where branch_slug=p_branch_slug) then raise exception 'orders_account_not_found'; end if;
  insert into public.admin_audit_log(actor_user_id,action,target_type,target_id,branch_slug,reason)
  values(auth.uid(),'orders_password_reset_'||p_phase,'branch',p_branch_slug,p_branch_slug,pg_catalog.btrim(p_reason));
end;
$fn$;
revoke all on function public.azal_admin_orders_password_audit(text,text,text) from public, anon, authenticated;
grant execute on function public.azal_admin_orders_password_audit(text,text,text) to authenticated;

-- A2: scrub customer PII in public profile and suspend membership. Auth email + ban are handled
-- by the server-only Edge Function; ledger/order snapshots are retained against the pseudonymous profile.
-- A2 anonymization is callable only from the server-side Edge Function after it has banned
-- sign-in. It also scrubs Auth metadata/identities so no old email, phone or name survives there.
create or replace function public.azal_admin_anonymize_customer_server(
  p_actor_id uuid,p_user_id uuid,p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_member bigint; v_replacement text;
begin
  if p_actor_id is null or not exists(
    select 1 from public.user_roles r where r.user_id=p_actor_id and r.role='admin'
  ) then raise exception 'not_admin' using errcode='42501'; end if;
  if p_user_id is null or pg_catalog.btrim(coalesce(p_reason,''))='' then raise exception 'reason_required'; end if;
  v_replacement := 'removed+'||pg_catalog.replace(p_user_id::text,'-','')||'@example.invalid';
  select p.member_number into v_member from public.profiles p where p.id=p_user_id and p.anonymized_at is null for update;
  if v_member is null then raise exception 'customer_not_found_or_already_removed'; end if;
  if exists(select 1 from public.user_roles r where r.user_id=p_user_id and r.role in ('admin','staff','manager')) then raise exception 'not_customer_account'; end if;

  update auth.users
     set email=v_replacement, phone=null, raw_user_meta_data='{}'::jsonb
   where id=p_user_id;
  update auth.identities
     set identity_data=pg_catalog.jsonb_build_object(
       'sub',coalesce(identity_data->>'sub',p_user_id::text),'email',v_replacement
     ),
     updated_at=pg_catalog.now()
   where user_id=p_user_id;

  update public.profiles
     set display_name=null, phone=null, anonymized_at=pg_catalog.now(), member_number_retired=true
   where id=p_user_id;
  update public.memberships set status='suspended' where user_id=p_user_id;
  -- Remove contact PII from historical orders while preserving order IDs, item snapshots, tax and totals.
  update public.orders set contact_phone=null, guest_name=null, guest_email=null where user_id=p_user_id;
  insert into public.admin_audit_log(actor_user_id,action,target_type,target_id,reason,metadata)
  values(p_actor_id,'customer_anonymized','customer',p_user_id::text,pg_catalog.btrim(p_reason),
         pg_catalog.jsonb_build_object('member_number_retired',true,'auth_email_replaced',true));
  return pg_catalog.jsonb_build_object('status','anonymized','user_id',p_user_id);
end;
$fn$;
revoke all on function public.azal_admin_anonymize_customer_server(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.azal_admin_anonymize_customer_server(uuid,uuid,text) to service_role;

-- Apply pending in-portal invitations only after the invitee has verified the matching email.
create or replace function public.azal_apply_team_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_invite public.admin_team_invites%rowtype; v_branch text;
begin
  if new.email is null or new.email_confirmed_at is null then return new; end if;
  insert into public.profiles(id) values(new.id) on conflict (id) do nothing;
  select * into v_invite from public.admin_team_invites i
   where pg_catalog.lower(i.email)=pg_catalog.lower(new.email)
     and i.accepted_at is null and i.revoked_at is null and i.expires_at>pg_catalog.now()
   order by i.created_at desc limit 1 for update;
  if not found then return new; end if;
  if exists(select 1 from public.profiles p where p.id=new.id and p.anonymized_at is not null) then return new; end if;
  update public.profiles set display_name=v_invite.display_name where id=new.id;
  delete from public.user_roles where user_id=new.id and role in ('staff','manager');
  delete from public.staff_branch_access where user_id=new.id;
  insert into public.user_roles(user_id,role) values(new.id,v_invite.role) on conflict do nothing;
  foreach v_branch in array v_invite.branch_slugs loop
    if exists(select 1 from public.branches b where b.slug=v_branch and b.active) then
      insert into public.staff_branch_access(user_id,branch_slug) values(new.id,v_branch) on conflict do nothing;
    end if;
  end loop;
  update public.admin_team_invites set accepted_user_id=new.id,accepted_at=pg_catalog.now() where id=v_invite.id;
  insert into public.admin_audit_log(actor_user_id,action,target_type,target_id,reason,metadata)
  values(v_invite.created_by,'team_invite_accepted','user',new.id::text,'Verified account matched pending team invite',
         pg_catalog.jsonb_build_object('role',v_invite.role,'branches',v_invite.branch_slugs));
  return new;
end;
$fn$;
revoke all on function public.azal_apply_team_invite() from public, anon, authenticated;
drop trigger if exists azal_apply_team_invite_after_auth_change on auth.users;
create trigger azal_apply_team_invite_after_auth_change
  after insert or update on auth.users
  for each row execute function public.azal_apply_team_invite();

-- Managers receive operational order summaries through this narrow RPC only. It deliberately omits
-- customer PII, payment state, subtotal, discounts, tax and totals.
create or replace function public.azal_manager_branch_orders(p_branch_slug text,p_limit integer default 50,p_offset integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare v_rows jsonb;
begin
  if auth.uid() is null or not public.azal_manager_can_access(p_branch_slug) then raise exception 'not_manager_for_branch' using errcode='42501'; end if;
  with page as (
    select o.id,o.branch_slug,o.fulfilment_status,o.placed_at,o.scheduled_for,
      (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'quantity',oi.quantity,'name_en',oi.item_name_en_snapshot,'name_fr',oi.item_name_fr_snapshot
      ) order by oi.id),'[]'::jsonb) from public.order_items oi where oi.order_id=o.id) as items
    from public.orders o
    where o.branch_slug=p_branch_slug
    order by o.placed_at desc,o.id desc
    limit greatest(1,least(coalesce(p_limit,50),100))
    offset greatest(0,least(coalesce(p_offset,0),100000))
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(page)),'[]'::jsonb) into v_rows from page;
  return v_rows;
end;
$fn$;
revoke all on function public.azal_manager_branch_orders(text,integer,integer) from public, anon, authenticated;
grant execute on function public.azal_manager_branch_orders(text,integer,integer) to authenticated;

commit;
