-- 0016 F-T14-1: least-privilege table access for the Admin Edge Function.
-- Match only the direct PostgREST reads and failed-provision cleanup deletes in
-- supabase/functions/admin-team-access/index.ts. Audit data remains RPC-only.
begin;

do $preflight$
begin
  if to_regclass('public.profiles') is null
     or to_regclass('public.user_roles') is null
     or to_regclass('public.branch_orders_accounts') is null
     or to_regclass('public.admin_team_invites') is null
     or to_regclass('public.memberships') is null then
    raise exception '0016 requires the T-14 0015 schema';
  end if;
end
$preflight$;

grant select on table
  public.profiles,
  public.user_roles,
  public.branch_orders_accounts,
  public.admin_team_invites
to service_role;

grant delete on table
  public.profiles,
  public.memberships
to service_role;

commit;
