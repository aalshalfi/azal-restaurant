-- 0007 points redemption increments: behaviour tests. Run on a FRESH db after stub + 0001-0004 + 0006 + 0007.
-- Output lines start with PASS/FAIL. Synthetic users only (*@example.invalid).
\set ON_ERROR_STOP 0
create or replace function public.zz_try(sql text) returns text language plpgsql as $$
begin execute sql; return 'ok'; exception when others then return coalesce(nullif(sqlerrm,''), sqlstate) || '|' || sqlstate; end $$;
create or replace function public.zz_eq(name text, got text, want text) returns text language sql as $$
select case when got = want or split_part(got,'|',1) = want or split_part(got,'|',2) = want then 'PASS  ' || name else 'FAIL  ' || name || '  (got ' || coalesce(got,'NULL') || ', want ' || want || ')' end $$;
grant execute on function public.zz_try(text), public.zz_eq(text,text,text) to anon, authenticated;

-- Fixtures: branch open all day, mandi $24.99, bread $5.99; member m1 with 25,000 pts, m2 with 249 pts (the owner's case), staff.
insert into public.branches(slug,name_en,name_fr,city,timezone,tax_rate_bps) values ('test','Test','Test','Toronto','America/Toronto',1300);
-- Near-24h overnight window keeps ASAP fixtures valid regardless of CI clock time, including the final 15 minutes of a civil day.
insert into public.branch_hours(branch_slug,weekday,opens_local,closes_local,closed) select 'test', d, '00:01','00:00', false from generate_series(0,6) d;
insert into public.menu_items(id,slug,name_en,name_fr,active) values
 ('00000000-0000-0000-0000-00000000a001','mandi','Lamb Mandi','Mandi d’agneau',true),
 ('00000000-0000-0000-0000-00000000a002','bread','Bread','Pain',true);
insert into public.branch_menu_items(branch_slug,menu_item_id,price_cents,available) values
 ('test','00000000-0000-0000-0000-00000000a001',2499,true),('test','00000000-0000-0000-0000-00000000a002',599,true);
insert into auth.users(id,email) values ('00000000-0000-0000-0000-0000000000d1','m1@example.invalid'),('00000000-0000-0000-0000-0000000000d2','m2@example.invalid'),('00000000-0000-0000-0000-0000000000f1','staff@example.invalid');
insert into public.user_roles(user_id,role) values ('00000000-0000-0000-0000-0000000000f1','staff');
insert into public.staff_branch_access(user_id,branch_slug) values ('00000000-0000-0000-0000-0000000000f1','test');
insert into public.points_ledger(user_id,event_key,entry_type,delta_points,reason) values
 ('00000000-0000-0000-0000-0000000000d1','seed:m1','earn',25000,'fixture'),('00000000-0000-0000-0000-0000000000d2','seed:m2','earn',249,'fixture');
update public.app_settings set value = 'test' where key = 'payments_mode';
select zz_eq('0007 config is one 10,000-point / 1,000-cent step', (select value from public.app_settings where key = 'redeem_tiers'), '10000:1000');
select zz_eq('existing orders keep discount 0 and pass the new total check', (select count(*)::text from pg_constraint where conname = 'order_total_consistent'), '1');
select zz_eq('5,000 legacy points are rejected by the helper', coalesce(public.azal_redeem_cents(5000)::text, 'null'), 'null');
select zz_eq('9,999 points cannot redeem', coalesce(public.azal_redeem_cents(9999)::text, 'null'), 'null');
select zz_eq('10,000 points redeem for 1,000 cents', public.azal_redeem_cents(10000)::text, '1000');
select zz_eq('19,999 points cannot redeem', coalesce(public.azal_redeem_cents(19999)::text, 'null'), 'null');
select zz_eq('20,000 points redeem for 2,000 cents', public.azal_redeem_cents(20000)::text, '2000');
select zz_eq('29,999 points cannot redeem', coalesce(public.azal_redeem_cents(29999)::text, 'null'), 'null');
select zz_eq('30,000 points redeem for 3,000 cents', public.azal_redeem_cents(30000)::text, '3000');
select zz_eq('invalid redeem config is rejected', zz_try('update public.app_settings set value = ''10000:1000,20000:2000'' where key = ''redeem_tiers'''), 'invalid_redeem_config');
\echo ===== anon
set role anon;
select zz_eq('anon cannot read redeem options', zz_try($$select public.redeem_options()$$), '42501');
select zz_eq('anon cannot call the balance helper', zz_try($$select public.azal_points_balance('00000000-0000-0000-0000-0000000000d1')$$), '42501');
select zz_eq('guest cannot redeem', zz_try($$select public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":1}]',null,null,'g-key-0000000000001','Amal','amal@example.invalid',10000)$$), 'redeem_members_only');
select zz_eq('guest order without points still works (default 0)', public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a002","quantity":1}]',null,null,'g-key-0000000000002','Amal','amal@example.invalid')->>'total_cents', '677');
reset role;

\echo ===== member m2 (249 pts, the owner's case)
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000d2',false) \gset
set role authenticated;
select zz_eq('redeem_options shows compact 10k increment descriptor for 249 balance', (public.redeem_options())::text, '{"balance": 249, "max_steps": 20, "step_points": 10000, "cents_per_step": 1000}');
select zz_eq('249 pts cannot redeem 10,000', zz_try($$select public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":1}]',null,null,'m2-key-000000000001',null,null,10000)$$), 'points_insufficient');
select zz_eq('helper not callable by members either', zz_try($$select public.azal_redeem_cents(10000)$$), '42501');
reset role;

\echo ===== member m1 (25,000 pts)
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000d1',false) \gset
set role authenticated;
select zz_eq('legacy 5,000-point redemption is rejected by place_order', zz_try($$select public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":1}]',null,null,'m1-key-0000000000000',null,null,5000)$$), 'invalid_redeem');
select zz_eq('a non-tier amount is refused', zz_try($$select public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":1}]',null,null,'m1-key-000000000001',null,null,7000)$$), 'invalid_redeem');
select zz_eq('negative points refused', zz_try($$select public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":1}]',null,null,'m1-key-000000000002',null,null,-10000)$$), 'invalid_redeem');
select zz_eq('reward larger than the order refused ($10 off a $5.99 bread)', zz_try($$select public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a002","quantity":1}]',null,null,'m1-key-000000000003',null,null,10000)$$), 'redeem_exceeds_order');
select (public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":2},{"menu_item_id":"00000000-0000-0000-0000-00000000a002","quantity":1}]',null,null,'m1-key-000000000004',null,null,10000))::text as o1 \gset
select zz_eq('10,000 pts on $55.97: discount 1000, HST on 4597 = 598, total 5195', (:'o1'::jsonb->>'subtotal_cents')||'/'||(:'o1'::jsonb->>'discount_cents')||'/'||(:'o1'::jsonb->>'tax_cents')||'/'||(:'o1'::jsonb->>'total_cents'), '5597/1000/598/5195');
select zz_eq('points not spent at placement (balance still 25000)', (select sum(delta_points)::text from public.points_ledger), '25000');
select zz_eq('same key, same cart, same points replays', case when public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a002","quantity":1},{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":2}]',null,null,'m1-key-000000000004',null,null,10000)->>'order_id' = :'o1'::jsonb->>'order_id' then 'same' else 'diff' end, 'same');
select zz_eq('same key, same cart, different points is a conflict', zz_try($$select public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":2},{"menu_item_id":"00000000-0000-0000-0000-00000000a002","quantity":1}]',null,null,'m1-key-000000000004',null,null,20000)$$), 'idempotency_conflict');
select zz_eq('same key, same cart, no points is a conflict', zz_try($$select public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":2},{"menu_item_id":"00000000-0000-0000-0000-00000000a002","quantity":1}]',null,null,'m1-key-000000000004')$$), 'idempotency_conflict');
select zz_eq('a declined card spends nothing', (public.pay_order_test((:'o1'::jsonb->>'order_id')::uuid,'tok_test_declined')->>'outcome') || '/' || (select sum(delta_points)::text from public.points_ledger), 'declined/25000');
select zz_eq('paid: charged 5195', public.pay_order_test((:'o1'::jsonb->>'order_id')::uuid,'tok_test_ok')->>'total_cents', '5195');
select zz_eq('paid: one redeem row of -10000, balance 15000', (select count(*) filter (where entry_type='redeem')||'/'||sum(delta_points) filter (where entry_type='redeem')||'/'||sum(delta_points) from public.points_ledger), '1/-10000/15000');
select zz_eq('replay after payment still replays (no false points_insufficient)', public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":2},{"menu_item_id":"00000000-0000-0000-0000-00000000a002","quantity":1}]',null,null,'m1-key-000000000004',null,null,10000)->>'replayed', 'true');
-- two unpaid orders each wanting 10,000 with 15,000 left: both may be placed, only the first payment succeeds.
select (public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":1}]',null,null,'m1-key-000000000005',null,null,10000))::text as o2 \gset
select (public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":1}]',null,null,'m1-key-000000000006',null,null,10000))::text as o3 \gset
select zz_eq('first of two pays', public.pay_order_test((:'o2'::jsonb->>'order_id')::uuid,'tok_test_ok')->>'outcome', 'paid');
select zz_eq('second payment refused: points already spent (no negative balance)', zz_try($$select public.pay_order_test('$$ || (:'o3'::jsonb->>'order_id') || $$','tok_test_ok')$$), 'points_insufficient');
select zz_eq('balance 5000, never negative', (select sum(delta_points)::text from public.points_ledger), '5000');
select zz_eq('customer still cannot write the ledger', zz_try($$insert into public.points_ledger(user_id,event_key,entry_type,delta_points,reason) values ('00000000-0000-0000-0000-0000000000d1','x','earn',99999,'x')$$), '42501');
reset role;

reset role;
select zz_eq('the refused order stays unpaid with no payment event', (select payment_status || '/' || (select count(*) from public.payment_events where order_id = o.id) from public.orders o where id = (:'o3'::jsonb->>'order_id')::uuid), 'unpaid/0');
\echo ===== staff: earn on the amount paid; cancel returns points once
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000f1',false) \gset
set role authenticated;
select zz_eq('accept', public.staff_update_order((:'o1'::jsonb->>'order_id')::uuid,'accept')->>'fulfilment_status', 'accepted');
select zz_eq('ready', public.staff_update_order((:'o1'::jsonb->>'order_id')::uuid,'ready')->>'fulfilment_status', 'ready');
select zz_eq('hand over', public.staff_update_order((:'o1'::jsonb->>'order_id')::uuid,'hand_over')->>'fulfilment_status', 'handed_over');
select zz_eq('cancel paid order 2: refunded', public.staff_update_order((:'o2'::jsonb->>'order_id')::uuid,'cancel')->>'payment_status', 'refunded');
reset role;
select zz_eq('earn on 4597 paid pre-tax = 459 pts (none on the $10 points discount)', (select delta_points::text from public.points_ledger where order_id = (:'o1'::jsonb->>'order_id')::uuid and entry_type = 'earn'), '459');
select zz_eq('cancel returned exactly 10000 once', (select count(*)||'/'||sum(delta_points) from public.points_ledger where order_id = (:'o2'::jsonb->>'order_id')::uuid and entry_type = 'redeem_refund'), '1/10000');
select zz_eq('refund event is the amount charged (2499-1000 + HST 195 = 1694)', (select amount_cents::text from public.payment_events where order_id = (:'o2'::jsonb->>'order_id')::uuid and event_type = 'refund_succeeded'), '1694');
select zz_eq('final balance 25000 - 10000 + 459 - 10000 + 10000 = 15459', (select sum(delta_points)::text from public.points_ledger where user_id = '00000000-0000-0000-0000-0000000000d1'), '15459');
select zz_eq('DB refuses a discount without points', zz_try($$update public.orders set discount_cents = 100, total_cents = total_cents - 100 where id = '$$ || (:'o3'::jsonb->>'order_id') || $$'$$), '23514');
select zz_eq('DB refuses an inconsistent total', zz_try($$update public.orders set total_cents = total_cents + 1 where id = '$$ || (:'o3'::jsonb->>'order_id') || $$'$$), '23514');

\echo ===== idempotent re-run of 0007 is covered by the chain runner
