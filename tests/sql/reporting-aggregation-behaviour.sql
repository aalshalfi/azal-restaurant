-- T-25/T-26 aggregate behaviour. Fresh PG16 after stub + baseline + 0002-0016 + 0017.
-- This file reuses the canonical two-branch ADM-1 fixtures and then exercises report scopes.
\ir admin-scope-behaviour.sql

\echo ===== Complete the two paid fixture orders through the existing kitchen transition RPC
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a0',false) \gset
set role authenticated;
select public.staff_update_order((:'o1'::jsonb->>'order_id')::uuid,'ready');
select public.staff_update_order((:'o1'::jsonb->>'order_id')::uuid,'hand_over');
select public.staff_update_order((:'o2'::jsonb->>'order_id')::uuid,'ready');
select public.staff_update_order((:'o2'::jsonb->>'order_id')::uuid,'hand_over');
select zz_eq('payment transition stamped both paid_at values',
  (select count(*)::text from public.orders where id in ((:'o1'::jsonb->>'order_id')::uuid,(:'o2'::jsonb->>'order_id')::uuid) and paid_at is not null),'2');
select zz_eq('paid_at is not exposed as client-controlled update',
  public.zz_try($$update public.orders set paid_at=paid_at - interval '1 day' where id='$$ || (:'o1'::jsonb->>'order_id') || $$'$$),'paid_at_is_immutable');
select zz_eq('Admin report contains all two branches',
  (public.azal_sales_report('day',(pg_catalog.now() at time zone 'America/Toronto')::date,(pg_catalog.now() at time zone 'America/Toronto')::date,null)->'rows'->0->>'branch_slug') is not null::text,'true');
select zz_eq('Admin all-branch report includes both collected orders',
  (public.azal_sales_report('day',(pg_catalog.now() at time zone 'America/Toronto')::date,(pg_catalog.now() at time zone 'America/Toronto')::date,null)->'totals'->>'collected_count'),'2');
select zz_eq('Admin report exposes authoritative subtotal, discount and tax snapshots',
  ((public.azal_sales_report('day',(pg_catalog.now() at time zone 'America/Toronto')::date,(pg_catalog.now() at time zone 'America/Toronto')::date,null)->'totals') ? 'subtotal_cents'
   and (public.azal_sales_report('day',(pg_catalog.now() at time zone 'America/Toronto')::date,(pg_catalog.now() at time zone 'America/Toronto')::date,null)->'totals') ? 'discount_cents'
   and (public.azal_sales_report('day',(pg_catalog.now() at time zone 'America/Toronto')::date,(pg_catalog.now() at time zone 'America/Toronto')::date,null)->'totals') ? 'tax_cents')::text,'true');
select zz_eq('Admin can filter to one branch',
  (public.azal_sales_report('day',(pg_catalog.now() at time zone 'America/Toronto')::date,(pg_catalog.now() at time zone 'America/Toronto')::date,'ottawa')->'totals'->>'collected_count'),'1');
reset role;

\echo ===== Manager receives only assigned-branch operational aggregates
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a0',false) \gset
set role authenticated;
select public.azal_admin_team_assign('c1@example.invalid','Manager C1','manager',array['ottawa'],'T-25 test assignment');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false) \gset
set role authenticated;
select zz_eq('Manager report is fixed to the assigned branch',
  (public.azal_sales_report('month',(pg_catalog.now() at time zone 'America/Toronto')::date,(pg_catalog.now() at time zone 'America/Toronto')::date,'ottawa')->'rows'->0->>'branch_slug'),'ottawa');
select zz_eq('Manager report contains no subtotal, discount or HST',
  ((public.azal_sales_report('month',(pg_catalog.now() at time zone 'America/Toronto')::date,(pg_catalog.now() at time zone 'America/Toronto')::date,'ottawa')->'totals') ? 'subtotal_cents'
   or (public.azal_sales_report('month',(pg_catalog.now() at time zone 'America/Toronto')::date,(pg_catalog.now() at time zone 'America/Toronto')::date,'ottawa')->'totals') ? 'discount_cents'
   or (public.azal_sales_report('month',(pg_catalog.now() at time zone 'America/Toronto')::date,(pg_catalog.now() at time zone 'America/Toronto')::date,'ottawa')->'totals') ? 'tax_cents')::text,'false');
select zz_eq('Manager cannot request an unassigned branch',
  public.zz_try($$select public.azal_sales_report('day',(now() at time zone 'America/Toronto')::date,(now() at time zone 'America/Toronto')::date,'second')$$),'branch_forbidden');
select zz_eq('Manager cannot call the Staff-only summary',
  public.zz_try($$select public.azal_staff_today_summary('ottawa')$$),'not_staff');
reset role;

\echo ===== Staff T-26 receives its branch-only summary without tax fields
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000aa',false) \gset
set role authenticated;
select zz_eq('Staff summary is for its assigned Ottawa branch',
  public.azal_staff_today_summary('ottawa')->>'branch_slug','ottawa');
select zz_eq('Staff summary counts only its collected Ottawa order',
  public.azal_staff_today_summary('ottawa')->>'collected_count','1');
select zz_eq('Staff summary excludes subtotal, discount and tax',
  ((public.azal_staff_today_summary('ottawa') ? 'subtotal_cents')
   or (public.azal_staff_today_summary('ottawa') ? 'discount_cents')
   or (public.azal_staff_today_summary('ottawa') ? 'tax_cents'))::text,'false');
select zz_eq('Staff cannot request another branch',
  public.zz_try($$select public.azal_staff_today_summary('second')$$),'not_staff');
reset role;

\echo ===== Customer cannot call T-25
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c2',false) \gset
set role authenticated;
select zz_eq('Customer is denied the sales report',
  public.zz_try($$select public.azal_sales_report('day',(now() at time zone 'America/Toronto')::date,(now() at time zone 'America/Toronto')::date,null)$$),'not_authorized');
reset role;

\echo ===== Toronto calendar boundary is DST-aware
select zz_eq('Toronto spring DST day is 23 hours',
  extract(epoch from ((timestamp '2026-03-09 00:00' at time zone 'America/Toronto') -
                      (timestamp '2026-03-08 00:00' at time zone 'America/Toronto')))::text,'82800.000000');
select zz_eq('Toronto fall DST day is 25 hours',
  extract(epoch from ((timestamp '2026-11-02 00:00' at time zone 'America/Toronto') -
                      (timestamp '2026-11-01 00:00' at time zone 'America/Toronto')))::text,'90000.000000');
