-- 0004 ordering functions: behaviour tests (Claude). Run on a FRESH db after stub + 0001 + 0002 + 0003 + 0004.
-- Output lines start with PASS/FAIL. Synthetic users only (*@example.invalid).
\set ON_ERROR_STOP 0
create or replace function public.zz_try(sql text) returns text language plpgsql as $$
begin execute sql; return 'ok'; exception when others then return coalesce(nullif(sqlerrm,''), sqlstate) || '|' || sqlstate; end $$;
create or replace function public.zz_eq(name text, got text, want text) returns text language sql as $$
select case when got = want or split_part(got,'|',1) = want or split_part(got,'|',2) = want then 'PASS  ' || name else 'FAIL  ' || name || '  (got ' || got || ', want ' || want || ')' end $$;
grant execute on function public.zz_try(text), public.zz_eq(text,text,text) to anon, authenticated;

-- Fixtures (as owner): branch, hours open all day every day, 3 items (one unavailable), users.
insert into public.branches(slug,name_en,name_fr,city,timezone,tax_rate_bps) values ('test','Test','Test','Toronto','America/Toronto',1300);
insert into public.branch_hours(branch_slug,weekday,opens_local,closes_local,closed) select 'test', d, '00:00','23:59', false from generate_series(0,6) d;
insert into public.menu_items(id,slug,name_en,name_fr,active) values
 ('00000000-0000-0000-0000-00000000a001','mandi','Lamb Mandi','Mandi d’agneau',true),
 ('00000000-0000-0000-0000-00000000a002','bread','Bread','Pain',true),
 ('00000000-0000-0000-0000-00000000a003','gone','Gone','Parti',true);
insert into public.branch_menu_items(branch_slug,menu_item_id,price_cents,available) values
 ('test','00000000-0000-0000-0000-00000000a001',2499,true),('test','00000000-0000-0000-0000-00000000a002',599,true),('test','00000000-0000-0000-0000-00000000a003',100,false);
insert into auth.users(id,email) values ('00000000-0000-0000-0000-0000000000c1','c1@example.invalid'),('00000000-0000-0000-0000-0000000000c2','c2@example.invalid'),('00000000-0000-0000-0000-0000000000f1','staff@example.invalid');
insert into public.user_roles(user_id,role) values ('00000000-0000-0000-0000-0000000000f1','staff');
insert into public.staff_branch_access(user_id,branch_slug) values ('00000000-0000-0000-0000-0000000000f1','test');
select zz_eq('payments_mode ships OFF (fail-closed) until the lead enables test', (select value from public.app_settings where key = 'payments_mode'), 'off');
update public.app_settings set value = 'test' where key = 'payments_mode';
select 'PASS  fixtures: trigger created memberships for new users = ' || count(*) from public.memberships;

\echo ===== anon
set role anon;
select zz_eq('anon without guest name/email refused', zz_try($$select public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":1}]',null,null,'anon-key-0000000001')$$), 'invalid_guest');
select zz_eq('anon cannot run staff actions', zz_try($$select public.staff_update_order(gen_random_uuid(),'accept')$$), '42501');
select zz_eq('anon cannot claim points', zz_try($$select public.claim_guest_points()$$), '42501');
reset role;

\echo ===== customer c1
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false) \gset
set role authenticated;
select (public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":2},{"menu_item_id":"00000000-0000-0000-0000-00000000a002","quantity":1}]',null,'  No onions please  ','c1-key-000000000001'))::text as o1 \gset
select zz_eq('ASAP order totals: subtotal 5597, tax 728 (13% half-up), total 6325', (:'o1'::jsonb->>'subtotal_cents')||'/'||(:'o1'::jsonb->>'tax_cents')||'/'||(:'o1'::jsonb->>'total_cents'), '5597/728/6325');
select zz_eq('ASAP pickup is >= now+20min and on a 5-minute mark', ((:'o1'::jsonb->>'pickup_at')::timestamptz >= now() + interval '19 minutes' and extract(epoch from (:'o1'::jsonb->>'pickup_at')::timestamptz)::bigint % 300 = 0)::text, 'true');
select zz_eq('note trimmed and stored', (select customer_note from public.orders where id = (:'o1'::jsonb->>'order_id')::uuid), 'No onions please');
select zz_eq('same key + same cart replays the same order', case when (public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a002","quantity":1},{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":2}]',null,'No onions please','c1-key-000000000001')->>'order_id') = (:'o1'::jsonb->>'order_id') then 'same' else 'different' end, 'same');
select zz_eq('same key + different cart refused', zz_try($$select public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":5}]',null,null,'c1-key-000000000001')$$), 'idempotency_conflict');
select zz_eq('only one order exists for c1 so far', (select count(*)::text from public.orders), '1');
select zz_eq('unavailable item refused, nothing written', zz_try($$select public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a003","quantity":1}]',null,null,'c1-key-000000000002')$$), 'item_unavailable');
select zz_eq('unknown item refused', zz_try($$select public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000ffff","quantity":1}]',null,null,'c1-key-000000000003')$$), 'item_unavailable');
select zz_eq('quantity 0 refused', zz_try($$select public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":0}]',null,null,'c1-key-000000000004')$$), 'invalid_items');
select zz_eq('quantity 21 refused', zz_try($$select public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":21}]',null,null,'c1-key-000000000005')$$), 'invalid_items');
select zz_eq('note over 500 chars refused', zz_try($$select public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a002","quantity":1}]',null,repeat('x',501),'c1-key-000000000006')$$), 'note_too_long');
select zz_eq('next grid slot (under 20 min away) is too soon', zz_try($$select public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a002","quantity":1}]',to_timestamp(ceil(extract(epoch from now())/900)*900),null,'c1-key-000000000007')$$), 'too_soon');
select zz_eq('off-grid pickup time refused', zz_try($$select public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a002","quantity":1}]',((current_date + 1) + time '12:07') at time zone 'America/Toronto',null,'c1-key-000000000010')$$), 'invalid_pickup_time');
select zz_eq('SQL NULL items refused', zz_try($$select public.place_order('test',null,null,null,'c1-key-000000000011')$$), 'invalid_items');
select zz_eq('JSON null items refused', zz_try($$select public.place_order('test','null',null,null,'c1-key-000000000012')$$), 'invalid_items');
select zz_eq('missing quantity refused', zz_try($$select public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a002"}]',null,null,'c1-key-000000000013')$$), 'invalid_items');
select zz_eq('null quantity refused', zz_try($$select public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a002","quantity":null}]',null,null,'c1-key-000000000014')$$), 'invalid_items');
select zz_eq('string quantity refused', zz_try($$select public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a002","quantity":"2"}]',null,null,'c1-key-000000000015')$$), 'invalid_items');
select zz_eq('malformed entry refused', zz_try($$select public.place_order('test','[5]',null,null,'c1-key-000000000016')$$), 'invalid_items');
select zz_eq('merged duplicates over 20 refused', zz_try($$select public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a002","quantity":15},{"menu_item_id":"00000000-0000-0000-0000-00000000a002","quantity":15}]',null,null,'c1-key-000000000017')$$), 'invalid_items');
select zz_eq('member passing guest fields refused', zz_try($$select public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a002","quantity":1}]',null,null,'c1-key-000000000018','Amal','amal@example.invalid')$$), 'invalid_guest');
select zz_eq('explicit grid time is stored as given and as the slot', (select (r->>'pickup_at')::timestamptz = (r->>'slot')::timestamptz and (r->>'slot')::timestamptz = ((current_date + 1) + time '13:00') at time zone 'America/Toronto' from (select public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a002","quantity":1}]',((current_date + 1) + time '13:00') at time zone 'America/Toronto',null,'c1-key-000000000019') r) x)::text, 'true');
select zz_eq('customer cannot write orders directly', zz_try($$update public.orders set total_cents = 1$$), '42501');
select zz_eq('customer cannot run staff actions', zz_try($$select public.staff_update_order('$$ || (:'o1'::jsonb->>'order_id') || $$','mark_paid')$$), 'not_staff');
-- capacity: 6 orders in the same slot tomorrow 12:00 local, the 7th refused
select zz_eq('6 orders fit in one slot', (select string_agg(coalesce(public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a002","quantity":1}]',((current_date + 1) + time '12:00') at time zone 'America/Toronto',null,'cap-key-00000000000'||g)->>'status','x'),',') from generate_series(1,6) g), 'placed,placed,placed,placed,placed,placed');
select zz_eq('7th order in that slot refused', zz_try($$select public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a002","quantity":1}]',((current_date + 1) + time '12:00') at time zone 'America/Toronto',null,'cap-key-000000000007')$$), 'slot_full');
reset role;

\echo ===== closed day
update public.branch_hours set closed = true, opens_local = null, closes_local = null where branch_slug='test' and weekday = extract(dow from (current_date + 2))::smallint;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false) \gset
set role authenticated;
select zz_eq('order on a closed day refused', zz_try($$select public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a002","quantity":1}]',((current_date + 2) + time '12:00') at time zone 'America/Toronto',null,'c1-key-000000000008')$$), 'closed');
reset role;

\echo ===== privacy
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c2',false) \gset
set role authenticated;
select zz_eq('another customer sees none of c1''s orders', (select count(*)::text from public.orders), '0');
reset role;

\echo ===== test payments (owner rule: paid online before the kitchen acts)
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000f1',false) \gset
set role authenticated;
select zz_eq('kitchen cannot accept an unpaid order', zz_try($$select public.staff_update_order('$$ || (:'o1'::jsonb->>'order_id') || $$','accept')$$), 'unpaid_order');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c2',false) \gset
set role authenticated;
select zz_eq('another customer cannot pay c1''s order', zz_try($$select public.pay_order_test('$$ || (:'o1'::jsonb->>'order_id') || $$','tok_test_ok')$$), 'order_not_found');
select zz_eq('client cannot read app_settings', zz_try($$select * from public.app_settings$$), '42501');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false) \gset
set role authenticated;
select zz_eq('declined test card leaves the order unpaid', public.pay_order_test((:'o1'::jsonb->>'order_id')::uuid,'tok_test_declined')->>'outcome', 'declined');
select zz_eq('insufficient funds reason', public.pay_order_test((:'o1'::jsonb->>'order_id')::uuid,'tok_test_insufficient')->>'reason', 'insufficient_funds');
select zz_eq('unknown token refused (no real cards)', zz_try($$select public.pay_order_test('$$ || (:'o1'::jsonb->>'order_id') || $$','4242424242424242')$$), 'invalid_test_token');
select zz_eq('still unpaid after declines', (select payment_status from public.orders where id = (:'o1'::jsonb->>'order_id')::uuid), 'unpaid');
select zz_eq('test card pays the order', public.pay_order_test((:'o1'::jsonb->>'order_id')::uuid,'tok_test_ok')->>'outcome', 'paid');
select zz_eq('paying twice refused', zz_try($$select public.pay_order_test('$$ || (:'o1'::jsonb->>'order_id') || $$','tok_test_ok')$$), 'already_paid');
reset role;
select zz_eq('payment events: 2 failed + 1 succeeded for the full total', (select string_agg(event_type||':'||amount_cents, ',' order by id) from public.payment_events where order_id = (:'o1'::jsonb->>'order_id')::uuid), 'payment_failed:0,payment_failed:0,payment_succeeded:6325');

\echo ===== staff flow and points
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000f1',false) \gset
set role authenticated;
select zz_eq('accept (paid)', public.staff_update_order((:'o1'::jsonb->>'order_id')::uuid,'accept')->>'fulfilment_status', 'accepted');
select zz_eq('hand over before ready refused', zz_try($$select public.staff_update_order('$$ || (:'o1'::jsonb->>'order_id') || $$','hand_over')$$), 'bad_transition');
select zz_eq('ready', public.staff_update_order((:'o1'::jsonb->>'order_id')::uuid,'ready')->>'fulfilment_status', 'ready');
select zz_eq('hand over', public.staff_update_order((:'o1'::jsonb->>'order_id')::uuid,'hand_over')->>'fulfilment_status', 'handed_over');
select zz_eq('closed order cannot move again', zz_try($$select public.staff_update_order('$$ || (:'o1'::jsonb->>'order_id') || $$','hand_over')$$), 'order_closed');
reset role;
select zz_eq('exactly one earn row: 559 points (10/$1 of $55.97, floored)', (select count(*)||'/'||sum(delta_points) from public.points_ledger where order_id = (:'o1'::jsonb->>'order_id')::uuid), '1/559');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false) \gset
set role authenticated;
select zz_eq('customer sees own balance 559', (select coalesce(sum(delta_points),0)::text from public.points_ledger), '559');
select (public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a002","quantity":2}]',null,null,'c1-key-000000000009'))::text as o2 \gset
select zz_eq('pay order 2', public.pay_order_test((:'o2'::jsonb->>'order_id')::uuid,'tok_test_ok')->>'outcome', 'paid');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000f1',false) \gset
set role authenticated;
select zz_eq('cancelling a paid order refunds it (test mode)', public.staff_update_order((:'o2'::jsonb->>'order_id')::uuid,'cancel')->>'payment_status', 'refunded');
reset role;
select zz_eq('refund event recorded for the full total', (select event_type||':'||amount_cents from public.payment_events where order_id = (:'o2'::jsonb->>'order_id')::uuid and event_type like 'refund%'), 'refund_succeeded:1354');
select zz_eq('no points for a cancelled order', (select count(*)::text from public.points_ledger where order_id = (:'o2'::jsonb->>'order_id')::uuid), '0');

\echo ===== unpaid holds expire; payments off
update public.orders set placed_at = placed_at - interval '20 minutes' where idempotency_key like 'cap-key-%';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false) \gset
set role authenticated;
select zz_eq('expired unpaid holds free the slot', public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a002","quantity":1}]',((current_date + 1) + time '12:00') at time zone 'America/Toronto',null,'cap-key-000000000008')->>'status', 'placed');
select zz_eq('paying an expired unpaid order refused', zz_try($$select public.pay_order_test(id,'tok_test_ok') from public.orders where idempotency_key = 'cap-key-000000000001'$$), 'payment_window_expired');
reset role;
update public.app_settings set value = 'off' where key = 'payments_mode';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false) \gset
set role authenticated;
select zz_eq('test payments refused when payments_mode is not test', zz_try($$select public.pay_order_test(id,'tok_test_ok') from public.orders where idempotency_key = 'cap-key-000000000008'$$), 'payments_not_in_test_mode');
reset role;
\echo ===== guest order, test payment, pending claim, claim after verified email
reset role;
update public.app_settings set value = 'test' where key = 'payments_mode';
select set_config('request.jwt.claim.sub','',false) \gset
set role anon;
select (public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":1}]',null,'Extra bread','guest-key-0000000001','Amal','Amal@Example.Invalid '))::text as g1 \gset
select zz_eq('guest order placed: 2499 + 325 = 2824, unpaid', (:'g1'::jsonb->>'total_cents')||'/'||(:'g1'::jsonb->>'payment_status'), '2824/unpaid');
select zz_eq('guest replay with same email+key returns same order', (public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":1}]',null,'Extra bread','guest-key-0000000001','Amal','amal@example.invalid')->>'replayed'), 'true');
select zz_eq('guest cannot read orders table', zz_try($$select count(*) from public.orders$$), '42501');
select zz_eq('guest pays with the wrong email refused', zz_try($$select public.pay_order_test('$$ || (:'g1'::jsonb->>'order_id') || $$','tok_test_ok','other@example.invalid')$$), 'order_not_found');
select zz_eq('guest pays with test card', public.pay_order_test((:'g1'::jsonb->>'order_id')::uuid,'tok_test_ok','AMAL@example.invalid')->>'outcome', 'paid');
reset role;
select zz_eq('guest order stored with lowercased email and name', (select guest_email||'/'||guest_name from public.orders where id=(:'g1'::jsonb->>'order_id')::uuid), 'amal@example.invalid/Amal');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000f1',false) \gset
set role authenticated;
select public.staff_update_order((:'g1'::jsonb->>'order_id')::uuid,'accept') is not null as a \gset
select public.staff_update_order((:'g1'::jsonb->>'order_id')::uuid,'ready') is not null as b \gset
select zz_eq('guest order handed over', public.staff_update_order((:'g1'::jsonb->>'order_id')::uuid,'hand_over')->>'fulfilment_status', 'handed_over');
reset role;
select zz_eq('guest order: pending claim of 249 points, no ledger row', (select c.points||'/'||c.status||'/'||(select count(*) from public.points_ledger l where l.order_id=c.order_id) from public.points_claims c where c.order_id=(:'g1'::jsonb->>'order_id')::uuid), '249/pending/0');
select zz_eq('claim expires in 90 days', (select (expires_at - created_at)::text from public.points_claims where order_id=(:'g1'::jsonb->>'order_id')::uuid), '90 days');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c2',false) \gset
select set_config('request.jwt.claim.email','someone@example.invalid',false) \gset
set role authenticated;
select zz_eq('a member with another email sees no pending points', public.my_pending_claims()->>'points', '0');
select zz_eq('and cannot claim them', public.claim_guest_points()->>'points_added', '0');
select zz_eq('members cannot read claims table', zz_try($$select * from public.points_claims$$), '42501');
reset role;
select set_config('request.jwt.claim.email','amal@example.invalid',false) \gset
set role authenticated;
select zz_eq('verified same email sees 249 pending', public.my_pending_claims()->>'points', '249');
select zz_eq('claim adds 249', public.claim_guest_points()->>'points_added', '249');
select zz_eq('claiming again adds nothing', public.claim_guest_points()->>'points_added', '0');
select zz_eq('member balance now 249', (select coalesce(sum(delta_points),0)::text from public.points_ledger), '249');
reset role;
-- expired claims cannot be claimed
insert into public.orders (branch_slug, guest_name, guest_email, idempotency_key, request_hash, subtotal_cents, tax_rate_bps, tax_cents, total_cents, payment_status, fulfilment_status, handed_over_at)
  values ('test','Old','old@example.invalid','old-key-00000000001',repeat('a',64),1000,1300,130,1130,'paid','handed_over',now()) returning id as old_id \gset
insert into public.points_claims (order_id, guest_email, points, expires_at, created_at) values (:'old_id','old@example.invalid',100, now() - interval '1 day', now() - interval '91 days');
select set_config('request.jwt.claim.email','old@example.invalid',false) \gset
set role authenticated;
select zz_eq('expired claim not shown', public.my_pending_claims()->>'points', '0');
select zz_eq('expired claim not claimable', public.claim_guest_points()->>'points_added', '0');
reset role;
\echo ===== overnight hours (18:00-02:00), attributed to the previous day
insert into public.branches(slug,name_en,name_fr,city,timezone,tax_rate_bps) values ('night','Night','Nuit','Toronto','America/Toronto',1300);
insert into public.branch_hours(branch_slug,weekday,opens_local,closes_local,closed) select 'night', d, '18:00','02:00', false from generate_series(0,6) d;
insert into public.branch_menu_items(branch_slug,menu_item_id,price_cents,available) values ('night','00000000-0000-0000-0000-00000000a002',599,true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false) \gset
set role authenticated;
select zz_eq('01:00 after midnight belongs to the previous evening window', public.place_order('night','[{"menu_item_id":"00000000-0000-0000-0000-00000000a002","quantity":1}]',((current_date + 2) + time '01:00') at time zone 'America/Toronto',null,'night-key-000000001')->>'status', 'placed');
select zz_eq('01:45 is past last pickup (02:00 - 15 min)', zz_try($$select public.place_order('night','[{"menu_item_id":"00000000-0000-0000-0000-00000000a002","quantity":1}]',((current_date + 2) + time '02:00') at time zone 'America/Toronto',null,'night-key-000000002')$$), 'closed');
select zz_eq('03:00 refused', zz_try($$select public.place_order('night','[{"menu_item_id":"00000000-0000-0000-0000-00000000a002","quantity":1}]',((current_date + 2) + time '03:00') at time zone 'America/Toronto',null,'night-key-000000003')$$), 'closed');
reset role;
update public.branch_hours set closed = true, opens_local = null, closes_local = null where branch_slug = 'night' and weekday = extract(dow from (current_date + 3))::smallint;
set role authenticated;
select zz_eq('01:00 on a closed day still valid when the previous evening was open', public.place_order('night','[{"menu_item_id":"00000000-0000-0000-0000-00000000a002","quantity":1}]',((current_date + 3) + time '01:00') at time zone 'America/Toronto',null,'night-key-000000004')->>'status', 'placed');
select zz_eq('but that closed day''s evening is refused', zz_try($$select public.place_order('night','[{"menu_item_id":"00000000-0000-0000-0000-00000000a002","quantity":1}]',((current_date + 3) + time '19:00') at time zone 'America/Toronto',null,'night-key-000000005')$$), 'closed');
reset role;
\echo ===== done
