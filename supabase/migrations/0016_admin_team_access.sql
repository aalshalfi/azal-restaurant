-- 0016 T-14 team access + customer privacy lifecycle + scalable T-08 directory.
-- Incremental migration: requires the already-applied 0001/0002/0003/0013/0014 chain.
-- No Auth credentials are exposed. Auth account ban/email replacement is performed only by the
-- admin-team-auth Edge Function using the server-held service-role key.
begin;

do $preflight$
begin
  if to_regclass('public.profiles') is null
     or to_regclass('public.user_roles') is null
     or to_regclass('public.staff_branch_access') is null
     or to_regclass('public.points_ledger') is null
     or to_regclass('public.memberships') is null
     or to_regclass('public.branches') is null
     or to_regprocedure('public.azal_is_admin()') is null
     or to_regclass('auth.users') is null then
    raise exception '0016 requires AZAL migrations 0001-0004, 0013 and 0014; no changes made';
  end if;
end;
$preflight$;

-- A2: a member number is retired, never deleted or reused.
alter table public.profiles
  add column if not exists member_number_retired boolean not null default false;

-- The role is server-owned. Managers are distinct from kitchen staff and always branch-scoped.
alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check
  check (role in ('customer','staff','manager','admin'));

-- Immutable audit trail for access changes and customer anonymization.
create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('team_access_granted','team_access_changed','team_access_revoked','customer_anonymized')),
  target_user_id uuid not null,
  branch_slug text references public.branches(slug) on delete set null,
  reason text not null check (char_length(trim(reason)) between 8 and 500),
  request_key uuid not null unique,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.admin_audit_log enable row level security;
revoke all on table public.admin_audit_log from public, anon, authenticated;
create index if not exists admin_audit_log_target_created_idx
  on public.admin_audit_log(target_user_id, created_at desc, id desc);

-- Managers can see their assigned branch's operational data; admins remain global.
create or replace function public.azal_staff_can_access(p_branch_slug text)
returns boolean
language sql stable security definer
set search_path = ''
as $fn$
  select auth.uid() is not null and (
    public.azal_is_admin()
    or exists (
      select 1 from public.user_roles r
      join public.staff_branch_access a on a.user_id = r.user_id
      where r.user_id = auth.uid()
        and r.role in ('staff','manager')
        and a.branch_slug = p_branch_slug
    )
  );
$fn$;
revoke all on function public.azal_staff_can_access(text) from public, anon;
grant execute on function public.azal_staff_can_access(text) to authenticated;

-- T-08 A1: bounded, server-filtered directory page. Email search stays inside this definer;
-- only one page (max 100 rows) and its derived balances cross the API boundary.
create or replace function public.azal_admin_customer_directory_page(
  p_search text default '',
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $fn$
declare
  v_term text := pg_catalog.btrim(coalesce(p_search,''));
  v_limit integer := greatest(1, least(coalesce(p_limit,50),100));
  v_offset integer := greatest(0, least(coalesce(p_offset,0),100000));
  v_total bigint;
  v_rows jsonb;
begin
  if auth.uid() is null or not public.azal_is_admin() then
    raise exception 'not_admin' using errcode='42501';
  end if;
  if pg_catalog.char_length(v_term) > 120 then
    raise exception 'search_too_long' using errcode='22023';
  end if;

  select count(*) into v_total
  from public.profiles p
  join auth.users u on u.id=p.id
  where p.anonymized_at is null
    and not exists (select 1 from public.user_roles r where r.user_id=p.id and r.role in ('admin','staff','manager'))
    and (v_term='' or
      p.display_name ilike '%'||v_term||'%' or
      coalesce(p.phone,'') ilike '%'||v_term||'%' or
      coalesce(u.email,'') ilike '%'||v_term||'%' or
      coalesce(p.member_number::text,'') ilike '%'||v_term||'%');

  select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc, q.user_id desc),'[]'::jsonb)
  into v_rows
  from (
    select p.id as user_id, p.display_name, p.phone, u.email::text as email,
      case when p.member_number_retired then null else p.member_number end as member_number,
      p.created_at,
      coalesce((select sum(l.delta_points)::bigint from public.points_ledger l where l.user_id=p.id),0) as balance,
      m.status as membership_status, m.joined_at
    from public.profiles p
    join auth.users u on u.id=p.id
    left join public.memberships m on m.user_id=p.id
    where p.anonymized_at is null
      and not exists (select 1 from public.user_roles r where r.user_id=p.id and r.role in ('admin','staff','manager'))
      and (v_term='' or p.display_name ilike '%'||v_term||'%' or coalesce(p.phone,'') ilike '%'||v_term||'%' or coalesce(u.email,'') ilike '%'||v_term||'%' or coalesce(p.member_number::text,'') ilike '%'||v_term||'%')
    order by p.created_at desc, p.id desc
    limit v_limit offset v_offset
  ) q;

  return jsonb_build_object('rows',v_rows,'total',v_total,'limit',v_limit,'offset',v_offset);
end;
$fn$;
revoke all on function public.azal_admin_customer_directory_page(text,integer,integer) from public, anon, authenticated;
grant execute on function public.azal_admin_customer_directory_page(text,integer,integer) to authenticated;

-- T-14 team directory: never returns Auth metadata, hashes, tokens or provider details.
create or replace function public.azal_admin_team_directory(p_search text default '', p_limit integer default 50, p_offset integer default 0)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $fn$
declare v_term text:=pg_catalog.btrim(coalesce(p_search,'')); v_limit integer:=greatest(1,least(coalesce(p_limit,50),100)); v_offset integer:=greatest(0,least(coalesce(p_offset,0),100000)); v_total bigint; v_rows jsonb;
begin
  if auth.uid() is null or not public.azal_is_admin() then raise exception 'not_admin' using errcode='42501'; end if;
  select count(*) into v_total from public.profiles p join auth.users u on u.id=p.id
    where p.anonymized_at is null and exists(select 1 from public.user_roles r where r.user_id=p.id and r.role in ('staff','manager','admin'))
      and (v_term='' or p.display_name ilike '%'||v_term||'%' or coalesce(u.email,'') ilike '%'||v_term||'%' or exists(select 1 from public.staff_branch_access a where a.user_id=p.id and a.branch_slug ilike '%'||v_term||'%'));
  select coalesce(jsonb_agg(to_jsonb(q) order by q.display_name,q.email),'[]'::jsonb) into v_rows from (
    select p.id as user_id,p.display_name,u.email::text as email,
      coalesce((select array_agg(r.role order by r.role) from public.user_roles r where r.user_id=p.id and r.role in ('staff','manager','admin')),array[]::text[]) as roles,
      coalesce((select array_agg(a.branch_slug order by a.branch_slug) from public.staff_branch_access a where a.user_id=p.id),array[]::text[]) as branches,
      p.created_at
    from public.profiles p join auth.users u on u.id=p.id
    where p.anonymized_at is null and exists(select 1 from public.user_roles r where r.user_id=p.id and r.role in ('staff','manager','admin'))
      and (v_term='' or p.display_name ilike '%'||v_term||'%' or coalesce(u.email,'') ilike '%'||v_term||'%' or exists(select 1 from public.staff_branch_access a where a.user_id=p.id and a.branch_slug ilike '%'||v_term||'%'))
    order by p.display_name,u.email limit v_limit offset v_offset
  ) q;
  return jsonb_build_object('rows',v_rows,'total',v_total,'limit',v_limit,'offset',v_offset);
end;
$fn$;
revoke all on function public.azal_admin_team_directory(text,integer,integer) from public,anon,authenticated;
grant execute on function public.azal_admin_team_directory(text,integer,integer) to authenticated;

-- Admin-only atomic role/branch assignment. The UI cannot choose its own authority.
create or replace function public.azal_admin_set_team_access(
  p_user_id uuid, p_role text, p_branch_slugs text[], p_reason text, p_request_key uuid
)
returns jsonb
language plpgsql security definer set search_path=''
as $fn$
declare v_old text[]; v_new text[]; v_branches text[]; v_action text;
begin
  if auth.uid() is null or not public.azal_is_admin() then raise exception 'not_admin' using errcode='42501'; end if;
  if p_user_id is null or p_user_id=auth.uid() then raise exception 'invalid_target' using errcode='22023'; end if;
  if p_role not in ('staff','manager','admin','revoke') then raise exception 'invalid_role' using errcode='22023'; end if;
  if p_request_key is null or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason,''))) not between 8 and 500 then raise exception 'reason_required' using errcode='22023'; end if;
  if not exists(select 1 from public.profiles where id=p_user_id and anonymized_at is null) then raise exception 'target_not_found' using errcode='P0002'; end if;
  v_branches:=coalesce(p_branch_slugs,array[]::text[]);
  if p_role in ('staff','manager') and (cardinality(v_branches)=0 or exists(select 1 from unnest(v_branches) x where not exists(select 1 from public.branches b where b.slug=x and b.active))) then raise exception 'valid_branch_required' using errcode='22023'; end if;
  if p_role='admin' and cardinality(v_branches)>0 then raise exception 'admin_is_global' using errcode='22023'; end if;
  select coalesce(array_agg(role order by role),array[]::text[]) into v_old from public.user_roles where user_id=p_user_id and role in ('staff','manager','admin');
  delete from public.user_roles where user_id=p_user_id and role in ('staff','manager','admin');
  delete from public.staff_branch_access where user_id=p_user_id;
  if p_role<>'revoke' then
    insert into public.user_roles(user_id,role) values(p_user_id,p_role);
    insert into public.staff_branch_access(user_id,branch_slug) select p_user_id,x from unnest(v_branches) x on conflict do nothing;
  end if;
  select coalesce(array_agg(role order by role),array[]::text[]) into v_new from public.user_roles where user_id=p_user_id and role in ('staff','manager','admin');
  v_action:=case when cardinality(v_new)=0 then 'team_access_revoked' when cardinality(v_old)=0 then 'team_access_granted' else 'team_access_changed' end;
  insert into public.admin_audit_log(actor_user_id,action,target_user_id,reason,request_key,details)
    values(auth.uid(),v_action,p_user_id,pg_catalog.btrim(p_reason),p_request_key,
      jsonb_build_object('old_roles',v_old,'new_roles',v_new,'old_branches',(select coalesce(jsonb_agg(branch_slug order by branch_slug),'[]') from public.staff_branch_access where user_id=p_user_id),'new_branches',v_branches));
  return jsonb_build_object('user_id',p_user_id,'roles',v_new,'branches',v_branches);
exception when unique_violation then raise exception 'duplicate_request' using errcode='23505';
end;
$fn$;
revoke all on function public.azal_admin_set_team_access(uuid,text,text[],text,uuid) from public,anon,authenticated;
grant execute on function public.azal_admin_set_team_access(uuid,text,text[],text,uuid) to authenticated;

-- A2 DB half. The edge function first bans the Auth account and replaces its email through Supabase Admin API;
-- this RPC then scrubs profile PII, suspends membership and records the mandatory reason. History/ledger rows remain.
create or replace function public.azal_admin_anonymize_customer(p_user_id uuid,p_reason text,p_request_key uuid)
returns jsonb
language plpgsql security definer set search_path=''
as $fn$
begin
  if auth.uid() is null or not public.azal_is_admin() then raise exception 'not_admin' using errcode='42501'; end if;
  if p_user_id is null or p_user_id=auth.uid() then raise exception 'invalid_target' using errcode='22023'; end if;
  if p_request_key is null or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_reason,''))) not between 8 and 500 then raise exception 'reason_required' using errcode='22023'; end if;
  if not exists(select 1 from public.profiles p where p.id=p_user_id and p.anonymized_at is null)
     or exists(select 1 from public.user_roles r where r.user_id=p_user_id and r.role in ('admin','staff','manager')) then
    raise exception 'customer_not_found' using errcode='P0002';
  end if;
  update public.profiles set display_name=null,phone=null,anonymized_at=now(),member_number_retired=true where id=p_user_id;
  update public.memberships set status='suspended' where user_id=p_user_id;
  insert into public.admin_audit_log(actor_user_id,action,target_user_id,reason,request_key,details)
    values(auth.uid(),'customer_anonymized',p_user_id,pg_catalog.btrim(p_reason),p_request_key,
      jsonb_build_object('member_number_retired',true,'financial_history_preserved',true));
  return jsonb_build_object('user_id',p_user_id,'anonymized',true,'financial_history_preserved',true);
exception when unique_violation then raise exception 'duplicate_request' using errcode='23505';
end;
$fn$;
revoke all on function public.azal_admin_anonymize_customer(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.azal_admin_anonymize_customer(uuid,text,uuid) to authenticated;

-- Audit history is read only and only by administrators.
create or replace function public.azal_admin_access_audit(p_limit integer default 100)
returns setof public.admin_audit_log
language plpgsql stable security definer set search_path=''
as $fn$
begin
  if auth.uid() is null or not public.azal_is_admin() then raise exception 'not_admin' using errcode='42501'; end if;
  return query select * from public.admin_audit_log order by created_at desc,id desc limit greatest(1,least(coalesce(p_limit,100),500));
end;
$fn$;
revoke all on function public.azal_admin_access_audit(integer) from public,anon,authenticated;
grant execute on function public.azal_admin_access_audit(integer) to authenticated;

comment on table public.admin_audit_log is 'Append-only audit trail for T-14 team access and customer anonymization.';
commit;
