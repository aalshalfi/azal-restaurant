-- T-08 database behaviour: run on a FRESH disposable PostgreSQL 16 database after the stub + 0001-0004.
-- Reuses the full admin/staff/customer role matrix and synthetic order fixtures, then drives terminal states and
-- verifies that the admin history/detail read path retains them and their immutable snapshots/events.
\ir admin-scope-behaviour.sql

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a0',false) \gset
set role authenticated;
select zz_eq('admin can advance a paid order to handed_over', public.staff_update_order((:'o1'::jsonb->>'order_id')::uuid,'ready')->>'fulfilment_status', 'ready');
select zz_eq('admin handover is persisted', public.staff_update_order((:'o1'::jsonb->>'order_id')::uuid,'hand_over')->>'fulfilment_status', 'handed_over');
select zz_eq('admin cancellation is persisted and paid order is refunded', (public.staff_update_order((:'o2'::jsonb->>'order_id')::uuid,'cancel')->>'fulfilment_status') || '/' || (select payment_status from public.orders where id = (:'o2'::jsonb->>'order_id')::uuid), 'cancelled/refunded');
select zz_eq('all terminal fulfilment states remain in admin history', (select string_agg(fulfilment_status, ',' order by fulfilment_status) from public.orders where id in ((:'o1'::jsonb->>'order_id')::uuid,(:'o2'::jsonb->>'order_id')::uuid)), 'cancelled,handed_over');
select zz_eq('admin can read complete immutable item snapshots for terminal orders', (select count(*)::text from public.order_items where order_id in ((:'o1'::jsonb->>'order_id')::uuid,(:'o2'::jsonb->>'order_id')::uuid)), '2');
select zz_eq('admin can read the event timeline for terminal orders', ((select count(*) from public.order_events where order_id in ((:'o1'::jsonb->>'order_id')::uuid,(:'o2'::jsonb->>'order_id')::uuid)) > 0)::text, 'true');
select zz_eq('cancelled order remains present after refund (not deleted)', (select count(*)::text from public.orders where id = (:'o2'::jsonb->>'order_id')::uuid and fulfilment_status='cancelled' and payment_status='refunded'), '1');
reset role;
