-- T-25/T-26 behavior. Fresh PG16 after stub + baseline + 0002-0016,
-- admin-scope-behaviour.sql, reporting-backfill-fixtures.sql, and migration 0017.
\set ON_ERROR_STOP 0

select id::text as o1 from public.orders where idempotency_key='c1-key-000000000001' \gset
select id::text as o2 from public.orders where idempotency_key='c2-key-000000000001' \gset
select id::text as o3 from public.orders where idempotency_key='c1-key-000000000003' \gset
select id::text as o4 from public.orders where idempotency_key='c1-key-000000000004' \gset
select id::text as o5 from public.orders where idempotency_key='c1-key-000000000005' \gset
select id::text as o6 from public.orders where idempotency_key='c1-key-000000000006' \gset

\echo ===== paid_at backfill provenance and fail-closed transition
select zz_eq('payment_events backfill uses the exact Toronto DST-day instant',
  (select (paid_at = timestamp '2026-03-08 00:30:00' at time zone 'America/Toronto')::text from public.orders where id=:'o1'::uuid),'true');
select zz_eq('legacy order_events backfill works without payment_succeeded',
  (select (paid_at = timestamp '2026-03-08 03:30:00' at time zone 'America/Toronto')::text from public.orders where id=:'o2'::uuid),'true');
select zz_eq('December month-end payment timestamp backfilled',
  (select (paid_at = timestamp '2026-12-31 23:59:59' at time zone 'America/Toronto')::text from public.orders where id=:'o3'::uuid),'true');
select zz_eq('January year-boundary payment timestamp backfilled',
  (select (paid_at = timestamp '2027-01-01 00:00:00' at time zone 'America/Toronto')::text from public.orders where id=:'o4'::uuid),'true');
select zz_eq('paid_at is immutable after backfill',
  public.zz_try(pg_catalog.format('update public.orders set paid_at=paid_at - interval ''1 day'' where id=%L', :'o1')),'paid_at_is_immutable');
select zz_eq('paid transition without payment_succeeded fails closed',
  public.zz_try(pg_catalog.format('update public.orders set payment_status=''paid'' where id=%L', :'o6')),'paid_at_payment_event_required');
select zz_eq('failed paid transition leaves the order unpaid',
  (select payment_status from public.orders where id=:'o6'::uuid),'unpaid');

\echo ===== hand over the collected fixtures; create refunds before and after handover
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a0',false) \gset
set role authenticated;
select public.staff_update_order(:'o1'::uuid,'ready');
select public.staff_update_order(:'o1'::uuid,'hand_over');
select public.staff_update_order(:'o3'::uuid,'accept');
select public.staff_update_order(:'o3'::uuid,'ready');
select public.staff_update_order(:'o3'::uuid,'hand_over');
select public.staff_update_order(:'o4'::uuid,'accept');
select public.staff_update_order(:'o4'::uuid,'ready');
select public.staff_update_order(:'o4'::uuid,'hand_over');
select public.staff_update_order(:'o5'::uuid,'accept');
select public.staff_update_order(:'o5'::uuid,'ready');
select public.staff_update_order(:'o5'::uuid,'hand_over');
reset role;

-- Full refund before handover: it must not enter collected/refunds/net.
insert into public.payment_events(order_id,provider,provider_event_id,event_type,amount_cents)
select id,'azal-test','report-refund-before-handover','refund_succeeded',total_cents
from public.orders where id=:'o2'::uuid;
update public.orders set payment_status='refunded' where id=:'o2'::uuid;

-- Partial refunds after handover: gross remains visible to Admin and refunds reduce net once.
insert into public.payment_events(order_id,provider,provider_event_id,event_type,amount_cents)
values (:'o3'::uuid,'azal-test','report-refund-after-handover-dec', 'refund_succeeded',500),
       (:'o5'::uuid,'azal-test','report-refund-after-handover-today','refund_succeeded',500);
update public.orders set payment_status='refunded' where id in (:'o3'::uuid,:'o5'::uuid);

\echo ===== Admin: fixed Toronto day/month/year aggregates and refund treatment
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a0',false) \gset
set role authenticated;
select zz_eq('Admin March 8 report includes both DST-day orders',
  (public.azal_sales_report('day',date '2026-03-08',date '2026-03-08',null)->'totals'->>'order_count'),'2');
select zz_eq('Admin March 8 report counts only the handed-over collection',
  (public.azal_sales_report('day',date '2026-03-08',date '2026-03-08',null)->'totals'->>'collected_count'),'1');
select zz_eq('Admin March 8 gross collected is correct',
  (public.azal_sales_report('day',date '2026-03-08',date '2026-03-08',null)->'totals'->>'collected_cents'),'2824');
select zz_eq('Pre-handover refund is excluded from collected refunds',
  (public.azal_sales_report('day',date '2026-03-08',date '2026-03-08',null)->'totals'->>'refunds_cents'),'0');
select zz_eq('Admin March 8 net equals gross when no collected refund exists',
  (public.azal_sales_report('day',date '2026-03-08',date '2026-03-08',null)->'totals'->>'net_collected_cents'),'2824');

select zz_eq('Admin December 2026 bucket starts on December 1 Toronto',
  (public.azal_sales_report('month',date '2026-12-01',date '2026-12-31',null)->'rows'->0->>'period_start'),'2026-12-01');
select zz_eq('Admin December gross collected includes the handed-over order',
  (public.azal_sales_report('month',date '2026-12-01',date '2026-12-31',null)->'totals'->>'collected_cents'),'2824');
select zz_eq('Admin December shows the partial refund separately',
  (public.azal_sales_report('month',date '2026-12-01',date '2026-12-31',null)->'totals'->>'refunds_cents'),'500');
select zz_eq('Admin December net deducts the partial refund once',
  (public.azal_sales_report('month',date '2026-12-01',date '2026-12-31',null)->'totals'->>'net_collected_cents'),'2324');

select zz_eq('Admin 2026 yearly bucket starts January 1',
  (public.azal_sales_report('year',date '2026-01-01',date '2026-12-31',null)->'rows'->0->>'period_start'),'2026-01-01');
select zz_eq('Admin 2026 includes four paid/refunded orders across branches',
  (public.azal_sales_report('year',date '2026-01-01',date '2026-12-31',null)->'totals'->>'order_count'),'4');
select zz_eq('Admin 2026 gross includes three handed-over orders',
  (public.azal_sales_report('year',date '2026-01-01',date '2026-12-31',null)->'totals'->>'collected_cents'),'8472');
select zz_eq('Admin 2026 refunds include only two post-handover partial refunds',
  (public.azal_sales_report('year',date '2026-01-01',date '2026-12-31',null)->'totals'->>'refunds_cents'),'1000');
select zz_eq('Admin 2026 net is gross less refunds',
  (public.azal_sales_report('year',date '2026-01-01',date '2026-12-31',null)->'totals'->>'net_collected_cents'),'7472');
select zz_eq('Admin 2027 yearly bucket contains the January 1 order',
  (public.azal_sales_report('year',date '2027-01-01',date '2027-12-31',null)->'totals'->>'net_collected_cents'),'2824');
select zz_eq('Admin January 2027 bucket starts January 1',
  (public.azal_sales_report('month',date '2027-01-01',date '2027-01-31',null)->'rows'->0->>'period_start'),'2027-01-01');
select zz_eq('Admin payload exposes refunds and net separately',
  ((public.azal_sales_report('year',date '2026-01-01',date '2026-12-31',null)->'totals') ? 'refunds_cents'
   and (public.azal_sales_report('year',date '2026-01-01',date '2026-12-31',null)->'totals') ? 'net_collected_cents')::text,'true');
reset role;

\echo ===== Manager: all assigned branches or one assigned branch, net only
reset role;
update auth.users set email_confirmed_at=pg_catalog.now() where id='00000000-0000-0000-0000-0000000000c1';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a0',false) \gset
set role authenticated;
select public.azal_admin_team_assign('c1@example.invalid','Manager C1','manager',array['ottawa'],'T-25 test assignment');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false) \gset
set role authenticated;
select zz_eq('Manager may report across all assigned branches',
  (public.azal_sales_report('year',date '2026-01-01',date '2026-12-31',null)->'totals'->>'order_count'),'3');
select zz_eq('Manager receives net after refunds',
  (public.azal_sales_report('year',date '2026-01-01',date '2026-12-31',null)->'totals'->>'net_collected_cents'),'7472');
select zz_eq('Manager payload omits gross and refund breakdown',
  ((public.azal_sales_report('year',date '2026-01-01',date '2026-12-31',null)->'totals') ? 'collected_cents'
   or (public.azal_sales_report('year',date '2026-01-01',date '2026-12-31',null)->'totals') ? 'refunds_cents'
   or (public.azal_sales_report('year',date '2026-01-01',date '2026-12-31',null)->'totals') ? 'subtotal_cents'
   or (public.azal_sales_report('year',date '2026-01-01',date '2026-12-31',null)->'totals') ? 'discount_cents'
   or (public.azal_sales_report('year',date '2026-01-01',date '2026-12-31',null)->'totals') ? 'tax_cents')::text,'false');
select zz_eq('Manager can select an assigned branch',
  (public.azal_sales_report('month',date '2026-12-01',date '2026-12-31','ottawa')->'totals'->>'net_collected_cents'),'2324');
select zz_eq('Manager cannot select an unassigned branch',
  public.zz_try($$select public.azal_sales_report('day',date '2026-03-08',date '2026-03-08','second')$$),'branch_forbidden');
select zz_eq('Manager cannot call the Staff-only summary',
  public.zz_try($$select public.azal_staff_today_summary('ottawa')$$),'not_staff');
reset role;

\echo ===== Staff T-26 current-day assigned-branch net only
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000aa',false) \gset
set role authenticated;
select zz_eq('Staff summary is scoped to its own branch',
  public.azal_staff_today_summary('ottawa')->>'branch_slug','ottawa');
select zz_eq('Staff today includes its handed-over order',
  public.azal_staff_today_summary('ottawa')->>'collected_count','1');
select zz_eq('Staff today nets the post-handover partial refund',
  public.azal_staff_today_summary('ottawa')->>'net_collected_cents','2324');
select zz_eq('Staff payload omits gross, refunds and tax breakdown',
  ((public.azal_staff_today_summary('ottawa') ? 'collected_cents')
   or (public.azal_staff_today_summary('ottawa') ? 'refunds_cents')
   or (public.azal_staff_today_summary('ottawa') ? 'subtotal_cents')
   or (public.azal_staff_today_summary('ottawa') ? 'discount_cents')
   or (public.azal_staff_today_summary('ottawa') ? 'tax_cents'))::text,'false');
select zz_eq('Staff cannot request another branch',
  public.zz_try($$select public.azal_staff_today_summary('second')$$),'not_staff');
reset role;

\echo ===== unauthorized customer cannot call T-25
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c2',false) \gset
set role authenticated;
select zz_eq('Customer is denied the sales report',
  public.zz_try($$select public.azal_sales_report('day',date '2026-03-08',date '2026-03-08',null)$$),'not_authorized');
reset role;

\echo ===== Toronto DST day lengths
select zz_eq('Toronto spring DST day is 23 hours',
  extract(epoch from ((timestamp '2026-03-09 00:00' at time zone 'America/Toronto') -
                      (timestamp '2026-03-08 00:00' at time zone 'America/Toronto')))::text,'82800.000000');
select zz_eq('Toronto fall DST day is 25 hours',
  extract(epoch from ((timestamp '2026-11-02 00:00' at time zone 'America/Toronto') -
                      (timestamp '2026-11-01 00:00' at time zone 'America/Toronto')))::text,'90000.000000');
