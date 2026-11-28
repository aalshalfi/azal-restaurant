-- 0013 T-23 membership number (owner order 2026-11-27 20:19; Claude).
-- Every registered person has a membership number: a plain integer, sequential from 10001, unbounded, unique, never
-- reused and never changed. Existing profiles are numbered in registration order (created_at, then id).
-- GAP-FREE: numbers come from one counter row updated inside the same transaction as the profile insert, so a
-- refused sign-up (0008 handle_new_user raises) rolls the counter back with it. A sequence would leave holes.
-- New profiles get their number from a BEFORE INSERT trigger, so handle_new_user (0008) needs no change.
-- Safe to run twice. Apply AFTER the T-23 front end is merged and deployed (the page shows the number only when the
-- column exists; before that it simply shows nothing).
begin;

create table if not exists public.azal_member_counter (
  id boolean primary key default true check (id),
  last_number bigint not null check (last_number >= 10000)
);
alter table public.azal_member_counter enable row level security; -- no policies: clients see and change nothing
revoke all on table public.azal_member_counter from public, anon, authenticated;
insert into public.azal_member_counter(id, last_number) values (true, 10000) on conflict (id) do nothing;

alter table public.profiles add column if not exists member_number bigint;

-- Backfill: only rows still without a number, in registration order, continuing after the highest number in use.
do $azal_0013$
declare r record; n bigint;
begin
  select greatest(c.last_number, coalesce((select max(member_number) from public.profiles), 10000))
    into n from public.azal_member_counter c where c.id for update;
  for r in select id from public.profiles where member_number is null order by created_at, id loop
    n := n + 1;
    update public.profiles set member_number = n where id = r.id;
  end loop;
  update public.azal_member_counter set last_number = n where id;
end
$azal_0013$;

alter table public.profiles alter column member_number set not null;

do $azal_0013c$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_member_number_key') then
    alter table public.profiles add constraint profiles_member_number_key unique (member_number);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_member_number_range') then
    alter table public.profiles add constraint profiles_member_number_range check (member_number >= 10001);
  end if;
end
$azal_0013c$;

-- Assigned on insert; whatever a caller supplies is ignored. The counter row lock serialises concurrent sign-ups.
create or replace function public.azal_assign_member_number()
returns trigger language plpgsql security definer set search_path = public as $azal_assign$
begin
  update public.azal_member_counter set last_number = last_number + 1 where id returning last_number into new.member_number;
  return new;
end
$azal_assign$;
-- Never changed once given (not by a member, an admin or the service role).
create or replace function public.azal_keep_member_number()
returns trigger language plpgsql set search_path = public as $azal_keep$
begin
  if new.member_number is distinct from old.member_number then
    raise exception 'member_number_immutable' using errcode = '42501';
  end if;
  return new;
end
$azal_keep$;
revoke all on function public.azal_assign_member_number(), public.azal_keep_member_number() from public, anon, authenticated;
drop trigger if exists profiles_assign_member_number on public.profiles;
create trigger profiles_assign_member_number before insert on public.profiles
  for each row execute function public.azal_assign_member_number();
drop trigger if exists profiles_keep_member_number on public.profiles;
create trigger profiles_keep_member_number before update of member_number on public.profiles
  for each row execute function public.azal_keep_member_number();

-- Reading: the member reads their own row through the existing profiles RLS (self or admin). Writing: authenticated
-- keeps only its column grants on display_name (0002) and phone (0008); member_number has none.

commit;
