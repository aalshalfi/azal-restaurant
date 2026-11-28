-- T-25/T-26 behavior and role matrix on fresh PG16 after migrations 0002-0017.
\ir admin-scope-behaviour.sql

\echo ===== T-25/T-26 fixture setup
reset role;
insert into public.user_roles(user_id,role) values ('00000000-0000-0000-0000-0000000000c1','manager') on conflict do nothing;
insert into public.staff_branch_access(user_id,branch_slug) values ('00000000-0000-0000-0000-0000000000c1','ottawa') on conflict do nothing;

\echo ===== T-25: Admin report uses successful payment timestamp and Toronto day
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a0',false) \gset
set role authenticated;
select public.staff_update_order((:'o1'::jsonb->>'order_id')::uuid,'ready');
select public.staff_update_order((:'o1'::jsonb->>'order_id')::uuid,'hand_over');
select public.staff_update_order((:'o2'::jsonb->>'order_id')::uuid,'ready');
select public.staff_update_order((:'o2'::jsonb->>'order_id')::uuid,'hand_over');
reset role;
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
select zz_eq('Admin net collected deducts handed-over refund once',
  (public.azal_admin_sales_report('day',(now() at time zone 'America/Toronto')::date,
    ((now() at time zone 'America/Toronto')::date+1),null)->'rows'->0->>'net_collected_cents'),'2824');
select zz_eq('Admin HST comes from stored order snapshots',
  (public.azal_admin_sales_report('day',(now() at time zone 'America/Toronto')::date,
    ((now() at time zone 'America/Toronto')::date+1),null)->'rows'->0->>'hst_cents'),'650');
select zz_eq('Admin can filter to one branch',
  (public.azal_admin_sales_report('day',(now() at time zone 'America/Toronto')::date,
    ((now() at time zone 'America/Toronto')::date+1),'ottawa')->'rows'->0->>'paid_orders'),'1');
select zz_eq('Monthly grouping returns the Toronto month boundary',
  (public.azal_admin_sales_report('month',date_trunc('month',now() at time zone 'America/Toronto')::date,
    ((now() at time zone 'America/Toronto')::date+1),null)->'rows'->0->>'period_start'),
  date_trunc('month',now() at time zone 'America/Toronto')::date::text);
select zz_eq('Yearly grouping returns the Toronto year boundary',
  (public.azal_admin_sales_report('year',date_trunc('year',now() at time zone 'America/Toronto')::date,
    ((now() at time zone 'America/Toronto')::date+1),null)->'rows'->0->>'period_start'),
  date_trunc('year',now() at time zone 'America/Toronto')::date::text);
reset role;

\echo ===== T-25: Manager receives assigned-branch operational totals only
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false) \gset
set role authenticated;
select zz_eq('Manager report scope is assigned branches',
  public.azal_admin_sales_report('day',(now() at time zone 'America/Toronto')::date,
    ((now() at time zone 'America/Toronto')::date+1),null)->>'scope','assigned_branches');
select zz_eq('Manager report includes only assigned Ottawa order',
  (public.azal_admin_sales_report('day',(now() at time zone 'America/Toronto')::date,
    ((now() at time zone 'America/Toronto')::date+1),null)->'rows'->0->>'paid_orders'),'1');
select zz_eq('Manager receives net collected total without a refund breakdown',
  (public.azal_admin_sales_report('day',(now() at time zone 'America/Toronto')::date,
    ((now() at time zone 'America/Toronto')::date+1),null)->'rows'->0->>'collected_cents'),'2824');
select zz_eq('Manager cannot request an unassigned branch',
  public.zz_try($$select public.azal_admin_sales_report('day',(now() at time zone 'America/Toronto')::date,((now() at time zone 'America/Toronto')::date+1),'second')$$),'not_manager_for_branch');
select zz_eq('Manager payload omits Admin financial breakdown',
  ((public.azal_admin_sales_report('day',(now() at time zone 'America/Toronto')::date,
    ((now() at time zone 'America/Toronto')::date+1),null)->'rows'->0) ? 'subtotal_cents'
    or (public.azal_admin_sales_report('day',(now() at time zone 'America/Toronto')::date,
    ((now() at time zone 'America/Toronto')::date+1),null)->'rows'->0) ? 'discount_cents'
    or (public.azal_admin_sales_report('day',(now() at time zone 'America/Toronto')::date,
    ((now() at time zone 'America/Toronto')::date+1),null)->'rows'->0) ? 'hst_cents'
    or (public.azal_admin_sales_report('day',(now() at time zone 'America/Toronto')::date,
    ((now() at time zone 'America/Toronto')::date+1),null)->'rows'->0) ? 'refunds_cents')::text,'false');
reset role;

\echo ===== T-26: Staff Today's summary is branch-bound and tax-free
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000aa',false) \gset
set role authenticated;
select zz_eq('Staff today summary returns one Ottawa handover',
  public.azal_staff_today_summary('ottawa')->>'handed_over_count','1');
select zz_eq('Staff summary returns net collected amount',
  public.azal_staff_today_summary('ottawa')->>'collected_cents','2824');
select zz_eq('Staff summary has no tax or Admin breakdown',
  ((public.azal_staff_today_summary('ottawa') ? 'hst_cents')
    or (public.azal_staff_today_summary('ottawa') ? 'subtotal_cents')
    or (public.azal_staff_today_summary('ottawa') ? 'discount_cents'))::text,'false');
select zz_eq('Staff cannot request another branch',
  public.zz_try($$select public.azal_staff_today_summary('second')$$),'not_staff_for_branch');
select zz_eq('Staff cannot invoke Manager/Admin report RPC',
  public.zz_try($$select public.azal_admin_sales_report('day',(now() at time zone 'America/Toronto')::date,((now() at time zone 'America/Toronto')::date+1),null)$$),'not_report_authorized');
reset role;

\echo ===== Forbidden callers
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c2',false) \gset
set role authenticated;
select zz_eq('Customer cannot invoke sales report',
  public.zz_try($$select public.azal_admin_sales_report('day',(now() at time zone 'America/Toronto')::date,((now() at time zone 'America/Toronto')::date+1),null)$$),'not_report_authorized');
select zz_eq('Customer cannot invoke staff summary',
  public.zz_try($$select public.azal_staff_today_summary('ottawa')$$),'not_staff_for_branch');
reset role;
set role anon;
select zz_eq('Anonymous cannot execute sales report',
  public.zz_try($$select public.azal_admin_sales_report('day',current_date,current_date+1,null)$$),'42501');
reset role;
