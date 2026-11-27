-- 0008 profile contact: behaviour tests (Claude). FRESH db after stub + 0001-0003 + 0008 (x2).
\set ON_ERROR_STOP 0
create or replace function public.zz_try(sql text) returns text language plpgsql as $$
begin execute sql; return 'ok'; exception when others then return coalesce(nullif(sqlerrm,''), sqlstate) || '|' || sqlstate; end $$;
create or replace function public.zz_eq(name text, got text, want text) returns text language sql as $$
select case when got = want or split_part(got,'|',1) = want or split_part(got,'|',2) = want then 'PASS  ' || name else 'FAIL  ' || name || '  (got ' || coalesce(got,'NULL') || ', want ' || want || ')' end $$;
grant execute on function public.zz_try(text), public.zz_eq(text,text,text) to anon, authenticated;

insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000e1','e1@example.invalid','{"display_name":"  Amal Saleh  ","phone":"(343) 999-0001"}'),
 ('00000000-0000-0000-0000-0000000000e2','e2@example.invalid','{"display_name":"","phone":"12"}'),
 ('00000000-0000-0000-0000-0000000000e3','e3@example.invalid','{}'),
 ('00000000-0000-0000-0000-0000000000e4','e4@example.invalid','{"display_name":"x\u0007y","phone":"+44 20 7946 0958"}');
select zz_eq('sign-up metadata: name trimmed, mobile normalised to +1', (select display_name||'|'||phone from public.profiles where id='00000000-0000-0000-0000-0000000000e1'), 'Amal Saleh|+13439990001');
select zz_eq('bad metadata is dropped, the account still exists', (select coalesce(display_name,'∅')||'/'||coalesce(phone,'∅') from public.profiles where id='00000000-0000-0000-0000-0000000000e2'), '∅/∅');
select zz_eq('no metadata: plain profile + membership as before', (select count(*)::text from public.profiles p join public.memberships m on m.user_id=p.id where p.id='00000000-0000-0000-0000-0000000000e3'), '1');
select zz_eq('control characters stripped; international +44 kept', (select display_name||'|'||phone from public.profiles where id='00000000-0000-0000-0000-0000000000e4'), 'xy|+442079460958');
select zz_eq('DB refuses a malformed phone written directly', zz_try($$update public.profiles set phone='343-999' where id='00000000-0000-0000-0000-0000000000e3'$$), '23514');

set role anon;
select zz_eq('anon cannot update a profile', zz_try($$select public.update_my_profile('A','3439990001')$$), '42501');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000e3',false) \gset
set role authenticated;
select zz_eq('member sets name + mobile', (public.update_my_profile(' Huda ', '343.999.0003'))::text, '{"phone": "+13439990003", "display_name": "Huda"}');
select zz_eq('member reads own profile with phone', (select display_name||'|'||phone from public.profiles), 'Huda|+13439990003');
select zz_eq('only own row visible', (select count(*)::text from public.profiles), '1');
select zz_eq('empty name refused', zz_try($$select public.update_my_profile('   ','3439990003')$$), 'invalid_name');
select zz_eq('81-char name refused', zz_try($$select public.update_my_profile(repeat('a',81),null)$$), 'invalid_name');
select zz_eq('malformed mobile refused (nothing changed)', zz_try($$select public.update_my_profile('Huda','12345')$$) || '/' || (select phone from public.profiles), 'invalid_phone|P0001/+13439990003');
select zz_eq('clearing the mobile is allowed', (public.update_my_profile('Huda', '  '))->>'phone' is null::text, 'true');
select zz_eq('client cannot write phone directly (bypassing validation)', zz_try($$update public.profiles set phone='+13439990009'$$), '42501');
select zz_eq('client can no longer touch another member (RLS)', (select count(*)::text from public.profiles where id='00000000-0000-0000-0000-0000000000e1'), '0');
select zz_eq('helpers not callable by clients', zz_try($$select public.azal_phone('3439990001')$$), '42501');
reset role;
