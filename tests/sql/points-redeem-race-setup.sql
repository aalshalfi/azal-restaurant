-- 0007 race: one member, 10,000 pts, two unpaid 10,000-pt orders paid at the same moment. Exactly one may succeed.
insert into public.branches(slug,name_en,name_fr,city,timezone,tax_rate_bps) values ('test','Test','Test','Toronto','America/Toronto',1300);
insert into public.branch_hours(branch_slug,weekday,opens_local,closes_local,closed) select 'test', d, '00:00','23:59', false from generate_series(0,6) d;
insert into public.menu_items(id,slug,name_en,name_fr,active) values ('00000000-0000-0000-0000-00000000a001','mandi','Lamb Mandi','Mandi',true);
insert into public.branch_menu_items(branch_slug,menu_item_id,price_cents,available) values ('test','00000000-0000-0000-0000-00000000a001',2499,true);
insert into auth.users(id,email) values ('00000000-0000-0000-0000-0000000000d1','m1@example.invalid');
insert into public.points_ledger(user_id,event_key,entry_type,delta_points,reason) values ('00000000-0000-0000-0000-0000000000d1','seed:m1','earn',10000,'fixture');
update public.app_settings set value = 'test' where key = 'payments_mode';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000d1',false);
set role authenticated;
select public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":1}]',null,null,'race-key-0000000001',null,null,10000);
select public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":1}]',null,null,'race-key-0000000002',null,null,10000);
