-- 0010 contact phone on orders: behaviour tests (Claude). FRESH db after stub + 0001-0010 (0010 applied twice).
\set ON_ERROR_STOP 0
create or replace function public.zz_try(sql text) returns text language plpgsql as $$
begin execute sql; return 'ok'; exception when others then return coalesce(nullif(sqlerrm,''), sqlstate) || '|' || sqlstate; end $$;
create or replace function public.zz_eq(name text, got text, want text) returns text language sql as $$
select case when got = want or split_part(got,'|',1) = want or split_part(got,'|',2) = want then 'PASS  ' || name else 'FAIL  ' || name || '  (got ' || coalesce(got,'NULL') || ', want ' || want || ')' end $$;
grant execute on function public.zz_try(text), public.zz_eq(text,text,text) to anon, authenticated;
insert into public.branches(slug,name_en,name_fr,city,timezone,tax_rate_bps) values ('test','Test','Test','Toronto','America/Toronto',1300);
insert into public.branch_hours(branch_slug,weekday,opens_local,closes_local,closed) select 'test', d, '00:00','23:59', false from generate_series(0,6) d;
insert into public.menu_items(id,slug,name_en,name_fr,active) values ('00000000-0000-0000-0000-00000000a001','mandi','Lamb Mandi','Mandi',true);
insert into public.branch_menu_items(branch_slug,menu_item_id,price_cents,available) values ('test','00000000-0000-0000-0000-00000000a001',2499,true);
insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000d1','m1@example.invalid','{"display_name":"Huda","phone":"3439990001"}'),
 ('00000000-0000-0000-0000-0000000000d2','m2@example.invalid','{}'),
 ('00000000-0000-0000-0000-0000000000f1','staff@example.invalid','{}'),
 ('00000000-0000-0000-0000-0000000000f2','other@example.invalid','{}');
insert into public.user_roles(user_id,role) values ('00000000-0000-0000-0000-0000000000f1','staff'),('00000000-0000-0000-0000-0000000000f2','staff');
insert into public.branches(slug,name_en,name_fr,city,timezone,tax_rate_bps) values ('other','Other','Other','Toronto','America/Toronto',1300);
insert into public.staff_branch_access(user_id,branch_slug) values ('00000000-0000-0000-0000-0000000000f1','test'),('00000000-0000-0000-0000-0000000000f2','other');

\echo ===== guests
set role anon;
select zz_eq('guest without a mobile is refused', zz_try($$select public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":1}]',null,null,'g-key-0000000000001','Amal','amal@example.invalid')$$), 'phone_required');
select zz_eq('guest with a blank mobile is refused', zz_try($$select public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":1}]',null,null,'g-key-0000000000002','Amal','amal@example.invalid',0,'   ')$$), 'phone_required');
select zz_eq('guest with a malformed mobile is refused (letters)', zz_try($$select public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":1}]',null,null,'g-key-0000000000003','Amal','amal@example.invalid',0,'343abc9990001')$$), 'invalid_phone');
select (public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":1}]',null,null,'g-key-0000000000004','Amal','amal@example.invalid',0,'(343) 999-0002'))->>'order_id' as g1 \gset
reset role;
select zz_eq('guest mobile stored normalised on the order', (select contact_phone from public.orders where id = :'g1'::uuid), '+13439990002');
set role anon;
select zz_eq('same key + same cart + same mobile replays', (public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":1}]',null,null,'g-key-0000000000004','Amal','amal@example.invalid',0,'343 999 0002'))->>'order_id', :'g1');
select zz_eq('same key + different mobile is a conflict', zz_try($$select public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":1}]',null,null,'g-key-0000000000004','Amal','amal@example.invalid',0,'3439990009')$$), 'idempotency_conflict');
reset role;

\echo ===== members
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000d1',false) \gset
set role authenticated;
select (public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":1}]',null,null,'m1-key-000000000001'))->>'order_id' as m1a \gset
select (public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":1}]',null,null,'m1-key-000000000002',null,null,0,'613 555 0199'))->>'order_id' as m1b \gset
select zz_eq('member without a mobile for this order gets the profile mobile', (select contact_phone from public.orders where id = :'m1a'::uuid), '+13439990001');
select zz_eq('member can give another mobile for this order only', (select contact_phone from public.orders where id = :'m1b'::uuid) || '/' || (select phone from public.profiles), '+16135550199/+13439990001');
select zz_eq('member with a malformed mobile is refused', zz_try($$select public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":1}]',null,null,'m1-key-000000000003',null,null,0,'++1 613')$$), 'invalid_phone');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000d2',false) \gset
set role authenticated;
select (public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":1}]',null,null,'m2-key-000000000001'))->>'order_id' as m2a \gset
reset role;
select zz_eq('member with no mobile anywhere: order still placed, phone empty', coalesce((select contact_phone from public.orders where id = :'m2a'::uuid), '∅'), '∅');

\echo ===== who can read the phone
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000f1',false) \gset
set role authenticated;
select zz_eq('branch staff read the phone on their branch''s orders', (select count(*) from public.orders where contact_phone is not null)::text, '3');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000f2',false) \gset
set role authenticated;
select zz_eq('staff of another branch read none of them', (select count(*) from public.orders)::text, '0');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000d2',false) \gset
set role authenticated;
select zz_eq('another member reads none of the phones', (select count(*) from public.orders where contact_phone is not null)::text, '0');
reset role;
select zz_eq('DB refuses a malformed phone written directly', zz_try($$update public.orders set contact_phone = '343-999' where id = '$$ || :'m2a' || $$'$$), '23514');
