-- Seed legacy paid rows before migration 0017 so backfill provenance is exercised.
-- Run only on the disposable PostgreSQL 16 reporting-checks database after admin-scope fixtures.
\set ON_ERROR_STOP 1

-- Order 1 uses the authoritative payment_events source at Toronto 00:30 on the spring DST day.
update public.payment_events pe
set received_at = timestamp '2026-03-08 00:30:00' at time zone 'America/Toronto'
where pe.order_id=(select id from public.orders where idempotency_key='c1-key-000000000001')
  and pe.event_type='payment_succeeded';

-- Order 2 models a legacy row with no payment_succeeded event but a durable order_events.paid record.
update public.payment_events pe
set event_type='payment_failed'
where pe.order_id=(select id from public.orders where idempotency_key='c2-key-000000000001')
  and pe.event_type='payment_succeeded';
update public.order_events oe
set created_at = timestamp '2026-03-08 03:30:00' at time zone 'America/Toronto'
where oe.order_id=(select id from public.orders where idempotency_key='c2-key-000000000001')
  and oe.event_type='paid';

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false) \gset
set role authenticated;
select (public.place_order('ottawa','[{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":1}]',null,null,'c1-key-000000000003'))::text as o3 \gset
select public.pay_order_test((:'o3'::jsonb->>'order_id')::uuid,'tok_test_ok') is not null as paid3 \gset
select (public.place_order('ottawa','[{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":1}]',null,null,'c1-key-000000000004'))::text as o4 \gset
select public.pay_order_test((:'o4'::jsonb->>'order_id')::uuid,'tok_test_ok') is not null as paid4 \gset
select (public.place_order('ottawa','[{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":1}]',null,null,'c1-key-000000000005'))::text as o5 \gset
select public.pay_order_test((:'o5'::jsonb->>'order_id')::uuid,'tok_test_ok') is not null as paid5 \gset
select (public.place_order('ottawa','[{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":1}]',null,null,'c1-key-000000000006'))::text as o6 \gset
reset role;

-- Deterministic month/year boundary fixtures, plus one current-Toronto-day Staff fixture.
update public.payment_events pe
set received_at = timestamp '2026-12-31 23:59:59' at time zone 'America/Toronto'
where pe.order_id=(select id from public.orders where idempotency_key='c1-key-000000000003')
  and pe.event_type='payment_succeeded';
update public.payment_events pe
set received_at = timestamp '2027-01-01 00:00:00' at time zone 'America/Toronto'
where pe.order_id=(select id from public.orders where idempotency_key='c1-key-000000000004')
  and pe.event_type='payment_succeeded';
update public.payment_events pe
set received_at = pg_catalog.now() - interval '1 hour'
where pe.order_id=(select id from public.orders where idempotency_key='c1-key-000000000005')
  and pe.event_type='payment_succeeded';

\echo PASS: payment_events and legacy order_events backfill fixtures seeded before 0017
\echo PASS: unpaid no-provenance fixture seeded for the trigger fail-closed test
