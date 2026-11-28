-- 0013 T-23 membership number: behaviour tests (Claude). Two members exist BEFORE 0013 is applied (runner: stub + 0001-0010,
-- seed, 0013 x2), so the backfill order and the re-run are both exercised.
\set ON_ERROR_STOP 0
create or replace function public.zz_try(sql text) returns text language plpgsql as $$
begin execute sql; return 'ok'; exception when others then return coalesce(nullif(sqlerrm,''), sqlstate) || '|' || sqlstate; end $$;
create or replace function public.zz_eq(name text, got text, want text) returns text language sql as $$
select case when got = want or split_part(got,'|',1) = want or split_part(got,'|',2) = want then 'PASS  ' || name else 'FAIL  ' || name || '  (got ' || coalesce(got,'NULL') || ', want ' || want || ')' end $$;
grant execute on function public.zz_try(text), public.zz_eq(text,text,text) to anon, authenticated;

select zz_eq('backfill: existing members numbered in registration order from 10001',
  (select string_agg(email || '=' || p.member_number, ',' order by p.member_number) from public.profiles p join auth.users u on u.id = p.id), 'early@example.invalid=10001,late@example.invalid=10002');
insert into auth.users(id,email,raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000c3','new@example.invalid','{"display_name":"Noor","phone":"6135550180"}');
select zz_eq('a new registration gets the next number', (select member_number::text from public.profiles where id='00000000-0000-0000-0000-0000000000c3'), '10003');
select zz_eq('the number cannot be changed (even by the owner role)', zz_try($$update public.profiles set member_number=10050 where id='00000000-0000-0000-0000-0000000000c3'$$), '42501');
select zz_eq('a refused sign-up is refused', (zz_try($$insert into auth.users(id,email,raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000c4','bad@example.invalid','{"display_name":"","phone":"1"}')$$) <> 'ok')::text, 'true');
insert into auth.users(id,email,raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000c5','next@example.invalid','{}');
select zz_eq('gap-free: the next registration after a refused one gets 10004, not 10005', (select member_number::text from public.profiles where id='00000000-0000-0000-0000-0000000000c5'), '10004');
select zz_eq('the number cannot be changed (even by the table owner)', zz_try($$update public.profiles set member_number=10050 where id='00000000-0000-0000-0000-0000000000c3'$$), '42501');
select zz_eq('numbers are unique and never below 10001', (select count(*)::text from pg_constraint where conname in ('profiles_member_number_key','profiles_member_number_range')), '2');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c3',false) \gset
set role authenticated;
select zz_eq('a member reads their own number', (select member_number::text from public.profiles), '10003');
select zz_eq('a member cannot write it', zz_try($$update public.profiles set member_number=10001$$), '42501');
select zz_eq('the counter is invisible to clients', zz_try($$select last_number from public.azal_member_counter$$), '42501');
select zz_eq('name/mobile editing still works with the number in place', (public.update_my_profile('Noor A', '6135550181'))->>'display_name', 'Noor A');
reset role;
select zz_eq('the edit left the number alone', (select member_number::text from public.profiles where id='00000000-0000-0000-0000-0000000000c3'), '10003');
