select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c2',false);
set role authenticated;
begin;
select public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a002","quantity":3}]',null,null,'conc-key-00000000001')->>'replayed' as replayed;
select pg_sleep(1.5);
commit;
