-- AZAL P2-FIX incremental patch for the already-created staging schema.
-- Apply only after Claude C-REV PASS and Muse's explicit gate.
-- Do not execute the 0001 baseline reference again.
begin;

do $azal_p2_preflight$
begin
  if to_regclass('public.profiles') is null
     or to_regclass('public.user_roles') is null
     or to_regclass('public.staff_branch_access') is null
     or to_regclass('public.points_ledger') is null
     or to_regclass('public.orders') is null
     or to_regprocedure('public.azal_is_admin()') is null then
    raise exception 'P2-FIX requires the existing AZAL 0001 schema; stop and do not apply to a blank project';
  end if;
  if to_regclass('auth.users') is null then
    raise exception 'P2-FIX requires Supabase Auth schema auth.users';
  end if;
end;
$azal_p2_preflight$;

-- F1-R1: decide admin access independently of staff branch membership.
create or replace function public.azal_staff_can_access(p_branch_slug text)
returns boolean
language sql stable security definer
set search_path = pg_catalog, public
as $azal_staff_access$
  select auth.uid() is not null
    and (
      public.azal_is_admin()
      or exists (
        select 1
        from public.user_roles r
        join public.staff_branch_access a on a.user_id = r.user_id
        where r.user_id = auth.uid()
          and r.role = 'staff'
          and a.branch_slug = p_branch_slug
      )
    );
$azal_staff_access$;
revoke all on function public.azal_staff_can_access(text) from public, anon;
grant execute on function public.azal_staff_can_access(text) to authenticated;
revoke all on function public.azal_is_admin() from public, anon;
grant execute on function public.azal_is_admin() to authenticated;

-- F1-R2: exactly one earn, one reversal and one redemption refund per source order.
-- event_key remains globally unique; no per-order uniqueness is imposed on redeem.
create unique index if not exists points_ledger_one_earn_per_order_idx
  on public.points_ledger (order_id)
  where order_id is not null and entry_type = 'earn';
create unique index if not exists points_ledger_one_earn_reversal_per_order_idx
  on public.points_ledger (order_id)
  where order_id is not null and entry_type = 'earn_reversal';
create unique index if not exists points_ledger_one_redeem_refund_per_order_idx
  on public.points_ledger (order_id)
  where order_id is not null and entry_type = 'redeem_refund';

-- F1-R3: create only the profile id; do not copy Auth metadata or collect a display name.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $azal_handle_new_user$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$azal_handle_new_user$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
drop trigger if exists azal_handle_new_user_after_insert on auth.users;
create trigger azal_handle_new_user_after_insert
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- C-REV Q5: defense in depth. Clear client DML on every current public table.
-- Regrant only the one column-level profile edit permitted by the existing RLS policy.
revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
revoke update (display_name) on table public.profiles from anon, authenticated;
grant update (display_name) on public.profiles to authenticated;

commit;

-- After applying, run docs/supabase-verify.sql Q1-Q12 plus Q5b in docs/p2-staging-apply.md.