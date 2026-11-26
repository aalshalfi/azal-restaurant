-- AZAL 0003: membership provisioning (Claude, ACCT; found by ChatGPT's PR #28 review).
-- Problem: handle_new_user() (0002) creates only a profile. memberships has no client INSERT (by design),
-- so a new member could never get a membership row. Fix server-side: the same trigger also creates
-- an 'active' membership; existing profiles are backfilled. No client grant is added.
-- Apply after 0001 + 0002. Idempotent: safe to run twice.
-- Assumption (ChatGPT review note): every profile is a Majlis member, staff and admins included; membership
-- grants nothing beyond earning/using points, so staff accounts holding one is harmless. search_path = ''.
begin;

do $azal_0003_preflight$
begin
  if to_regclass('public.memberships') is null or to_regprocedure('public.handle_new_user()') is null then
    raise exception '0003 requires 0001 + 0002 (memberships table and handle_new_user)';
  end if;
end;
$azal_0003_preflight$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $azal_handle_new_user$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  insert into public.memberships (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$azal_handle_new_user$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Backfill: every existing profile gets a membership (status defaults to 'active').
insert into public.memberships (user_id)
select p.id from public.profiles p
on conflict (user_id) do nothing;

-- Defense in depth: memberships stay server-written only.
revoke insert, update, delete, truncate on table public.memberships from anon, authenticated;

commit;
