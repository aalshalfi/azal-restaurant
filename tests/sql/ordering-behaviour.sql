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
select 'PASS  fixtures: trigger created memberships for new users = ' || count(*) from public.memberships;

\echo ===== anon
set role anon;
select zz_eq('anon cannot place_order', zz_try($$select public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":1}]',null,null,'anon-key-0000000001')$$), '42501');
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
select zz_eq('pickup in 5 minutes refused', zz_try($$select public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a002","quantity":1}]',now()+interval '5 minutes',null,'c1-key-000000000007')$$), 'too_soon');
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

\echo ===== staff flow and points
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000f1',false) \gset
set role authenticated;
select zz_eq('accept', public.staff_update_order((:'o1'::jsonb->>'order_id')::uuid,'accept')->>'fulfilment_status', 'accepted');
select zz_eq('hand over before ready refused', zz_try($$select public.staff_update_order('$$ || (:'o1'::jsonb->>'order_id') || $$','hand_over')$$), 'bad_transition');
select zz_eq('ready', public.staff_update_order((:'o1'::jsonb->>'order_id')::uuid,'ready')->>'fulfilment_status', 'ready');
select zz_eq('hand over unpaid refused', zz_try($$select public.staff_update_order('$$ || (:'o1'::jsonb->>'order_id') || $$','hand_over')$$), 'unpaid_handover');
select zz_eq('mark paid at pickup', public.staff_update_order((:'o1'::jsonb->>'order_id')::uuid,'mark_paid')->>'payment_status', 'paid');
select zz_eq('hand over', public.staff_update_order((:'o1'::jsonb->>'order_id')::uuid,'hand_over')->>'fulfilment_status', 'handed_over');
select zz_eq('closed order cannot move again', zz_try($$select public.staff_update_order('$$ || (:'o1'::jsonb->>'order_id') || $$','hand_over')$$), 'order_closed');
reset role;
select zz_eq('exactly one earn row: 559 points (10/$1 of $55.97, floored)', (select count(*)||'/'||sum(delta_points) from public.points_ledger where order_id = (:'o1'::jsonb->>'order_id')::uuid), '1/559');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false) \gset
set role authenticated;
select zz_eq('customer sees own balance 559', (select coalesce(sum(delta_points),0)::text from public.points_ledger), '559');
reset role;
\echo ===== done
