-- T-25/T-26 acceptance. Run on a fresh PG16 database after stub + baseline + migrations 0002-0016 + 0017.
-- Reuses the complete T-14/ADM-1 fixtures, then checks Admin/Manager/Staff/customer boundaries.
\ir admin-team-access-behaviour.sql

\echo ===== T-25: Admin reports bucket successful payment timestamps by Toronto day
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a0',false) \gset
set role authenticated;
select public.staff_update_order(:'o1'::jsonb->>'order_id','ready');
select public.staff_update_order(:'o1'::jsonb->>'order_id','hand_over');
select public.staff_update_order(:'o2'::jsonb->>'order_id','ready');
select public.staff_update_order(:'o2'::jsonb->>'order_id','hand_over');
reset role;
-- Simulate a full refund of one handed-over test order. Payment history remains append-only.
insert into public.payment_events(order_id,provider,provider_event_id,event_type,amount_cents)
select (:'o2'::jsonb->>'order_id')::uuid,'azal-test','report-refund-fixture','refund_succeeded',total_cents
from public.orders where id=(:'o2'::jsonb->>'order_id')::uuid;
update public.orders set payment_status='refunded' where id=(:'o2'::jsonb->>'order_id')::uuid;

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a0',false) \gset
set role authenticated;
select zz_eq('Admin daily report returns both paid orders',
  (public.azal_admin_sales_report('day',(now() at time zone 'America/Toronto')::date,
    ((now() at time zone 'America/Toronto')::date+1),null)->'rows'->0->>'paid_orders'),'2');
select zz_eq('Admin collected total follows handed-over convention',
  (public.azal_admin_sales_report('day',(now() at time zone 'America/Toronto')::date,
    ((now() at time zone 'America/Toronto')::date+1),null)->'rows'->0->>'collected_cents'),'5648');
select zz_eq('Admin refund is separately visible',
  (public.azal_admin_sales_report('day',(now() at time zone 'America/Toronto')::date,
    ((now() at time zone 'America/Toronto')::date+1),null)->'rows'->0->>'refunds_cents'),'2824');
select zz_eq('Admin net collected deducts the handed-over refund exactly once',
  (public.azal_admin_sales_report('day',(now() at time zone 'America/Toronto')::date,
    ((now() at time zone 'America/Toronto')::date+1),null)->'rows'->0->>'net_collected_cents'),'2824');
select zz_eq('Admin HST comes from stored order snapshots',
  (public.azal_admin_sales_report('day',(now() at time zone 'America/Toronto')::date,
    ((now() at time zone 'America/Toronto')::date+1),null)->'rows'->0->>'hst_cents'),'650');
select zz_eq('Admin can filter to one branch',
  (public.azal_admin_sales_report('day',(now() at time zone 'America/Toronto')::date,
    ((now() at time zone 'America/Toronto')::date+1),'ottawa')->'rows'->0->>'paid_orders'),'1');
reset role;

\echo ===== T-25: Manager sees assigned operational totals only
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false) \gset
set role authenticated;
select zz_eq('Manager report scope is assigned branches',
  public.azal_admin_sales_report('day',(now() at time zone 'America/Toronto')::date,
    ((now() at time zone 'America/Toronto')::date+1),null)->>'scope','assigned_branches');
select zz_eq('Manager report includes only assigned Ottawa order',
  (public.azal_admin_sales_report('day',(now() at time zone 'America/Toronto')::date,
    ((now() at time zone 'America/Toronto')::date+1),null)->'rows'->0->>'paid_orders'),'1');
select zz_eq('Manager cannot request an unassigned branch',
  public.zz_try($$select public.azal_admin_sales_report('day',(now() at time zone 'America/Toronto')::date,((now() at time zone 'America/Toronto')::date+1),'second')$$),'not_manager_for_branch');
select zz_eq('Manager payload omits all Admin financial breakdown keys',
  ((public.azal_admin_sales_report('day',(now() at time zone 'America/Toronto')::date,
    ((now() at time zone 'America/Toronto')::date+1),null)->'rows'->0) ? 'subtotal_cents'
    or (public.azal_admin_sales_report('day',(now() at time zone 'America/Toronto')::date,
    ((now() at time zone 'America/Toronto')::date+1),null)->'rows'->0) ? 'discount_cents'
    or (public.azal_admin_sales_report('day',(now() at time zone 'America/Toronto')::date,
    ((now() at time zone 'America/Toronto')::date+1),null)->'rows'->0) ? 'hst_cents'
    or (public.azal_admin_sales_report('day',(now() at time zone 'America/Toronto')::date,
    ((now() at time zone 'America/Toronto')::date+1),null)->'rows'->0) ? 'refunds_cents')::text,'false');
reset role;

\echo ===== T-26: Staff Today's summary is authenticated-branch-only and tax-free
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000aa',false) \gset
set role authenticated;
select zz_eq('Staff today summary returns one Ottawa handover',
  public.azal_staff_today_summary('ottawa')->>'handed_over_count','1');
select zz_eq('Staff summary returns net collected amount',
  public.azal_staff_today_summary('ottawa')->>'collected_cents','2824');
select zz_eq('Staff summary has no tax or financial breakdown',
  ((public.azal_staff_today_summary('ottawa') ? 'hst_cents')
    or (public.azal_staff_today_summary('ottawa') ? 'subtotal_cents')
    or (public.azal_staff_today_summary('ottawa') ? 'discount_cents'))::text,'false');
select zz_eq('Staff cannot request another branch',
  public.zz_try($$select public.azal_staff_today_summary('second')$$),'not_staff_for_branch');
select zz_eq('Staff cannot invoke Manager/Admin report RPC',
  public.zz_try($$select public.azal_admin_sales_report('day',(now() at time zone 'America/Toronto')::date,((now() at time zone 'America/Toronto')::date+1),null)$$),'not_report_authorized');
reset role;

\echo ===== T-25/T-26 forbidden callers
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c2',false) \gset
set role authenticated;
select zz_eq('Customer cannot invoke sales report',
  public.zz_try($$select public.azal_admin_sales_report('day',(now() at time zone 'America/Toronto')::date,((now() at time zone 'America/Toronto')::date+1),null)$$),'not_report_authorized');
select zz_eq('Customer cannot invoke staff summary',
  public.zz_try($$select public.azal_staff_today_summary('ottawa')$$),'not_staff_for_branch');
reset role;
select zz_eq('anonymous cannot execute sales report',
  public.zz_try($$set role anon; select public.azal_admin_sales_report('day',current_date,current_date+1,null)$$),'42501');
