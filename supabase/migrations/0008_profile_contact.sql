-- AZAL 0008: name + mobile on the member profile (F-OWN-2, F-OWN-8; owner first test 2026-11-27) (Claude).
-- Apply after 0001-0003 (independent of 0004-0007). Idempotent: safe to run twice. Run by the lead only.
--  * profiles gains phone (+E.164, the same rule as reservations: 10 digits -> +1, 11 starting with 1 -> +,
--    or '+' and 10-15 digits). display_name already exists (<= 80 chars).
--  * Sign-up sends {display_name, phone} as user metadata; handle_new_user() copies them into the profile,
--    cleaned and validated. Bad or missing values are simply not stored (the account is still created).
--  * update_my_profile(p_name, p_phone): the member edits their OWN name and mobile, validated server-side.
--    Email changes go through Supabase Auth itself (confirmation to the new address); nothing here.
begin;

do $azal_0008_preflight$
begin
  if to_regclass('public.profiles') is null or to_regclass('public.memberships') is null
     or to_regprocedure('public.handle_new_user()') is null then
    raise exception '0008 requires 0001 + 0002 + 0003';
  end if;
end;
$azal_0008_preflight$;

alter table public.profiles add column if not exists phone text;
do $c$ begin
  alter table public.profiles add constraint profile_phone_e164 check (phone is null or phone ~ '^\+[1-9][0-9]{9,14}$');
exception when duplicate_object then null; end $c$;

create or replace function public.azal_phone(p_phone text)
returns text language sql immutable set search_path = '' as $p$
  select case
    when d ~ '^[0-9]{10}$' then '+1' || d
    when d ~ '^1[0-9]{10}$' then '+' || d
    when coalesce(p_phone, '') ~ '^\s*\+' and d ~ '^[1-9][0-9]{9,14}$' then '+' || d
  end
  from (select pg_catalog.regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') as d) x
$p$;

create or replace function public.azal_clean_name(p_name text)
returns text language sql immutable set search_path = '' as $n$
  select case when pg_catalog.char_length(t) between 1 and 80 then t end
  from (select pg_catalog.btrim(pg_catalog.regexp_replace(coalesce(p_name, ''), '[[:cntrl:]]', '', 'g')) as t) x
$n$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $azal_handle_new_user$
begin
  insert into public.profiles (id, display_name, phone)
  values (new.id,
          public.azal_clean_name(new.raw_user_meta_data->>'display_name'),
          public.azal_phone(new.raw_user_meta_data->>'phone'))
  on conflict (id) do nothing;
  insert into public.memberships (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$azal_handle_new_user$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- update_my_profile: own row only. Stable error codes: signed_out, invalid_name, invalid_phone, no_profile.
create or replace function public.update_my_profile(p_name text, p_phone text)
returns jsonb language plpgsql security definer set search_path = '' as $u$
declare
  v_uid uuid := auth.uid();
  v_name text := public.azal_clean_name(p_name);
  v_phone text := public.azal_phone(p_phone);
begin
  if v_uid is null then raise exception 'signed_out'; end if;
  if v_name is null then raise exception 'invalid_name'; end if;
  if nullif(pg_catalog.btrim(coalesce(p_phone, '')), '') is not null and v_phone is null then raise exception 'invalid_phone'; end if;
  update public.profiles set display_name = v_name, phone = v_phone where id = v_uid;
  if not found then raise exception 'no_profile'; end if;
  return pg_catalog.jsonb_build_object('display_name', v_name, 'phone', v_phone);
end;
$u$;
revoke all on function public.update_my_profile(text, text) from public, anon;
grant execute on function public.update_my_profile(text, text) to authenticated;
revoke all on function public.azal_phone(text) from public, anon, authenticated;
revoke all on function public.azal_clean_name(text) from public, anon, authenticated;
-- The phone column is written only through update_my_profile (validated); clients keep update on display_name only.
revoke update (phone) on table public.profiles from anon, authenticated;

commit;
