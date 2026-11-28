-- T-14 + A1/A2 behavior. Run on a FRESH disposable PG16 database after stub + 0001-0014 + 0016.
-- Includes the existing ADM-1 two-branch fixtures, then exercises server paging, Manager scope,
-- pending verified invites, branch Orders identities and customer anonymization.
\ir admin-scope-behaviour.sql

\set ON_ERROR_STOP 0
reset role;
update auth.users set email_confirmed_at=pg_catalog.now()
where id in (
 '00000000-0000-0000-0000-0000000000a0',
 '00000000-0000-0000-0000-0000000000c1',
 '00000000-0000-0000-0000-0000000000c2'
);
update public.profiles set display_name='Customer One',phone='+16135550101' where id='00000000-0000-0000-0000-0000000000c1';
update public.profiles set display_name='Customer Two',phone='+16135550102' where id='00000000-0000-0000-0000-0000000000c2';

\echo ===== Admin: A1 server-side directory search and pagination
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a0',false) \gset
set role authenticated;
select zz_eq('directory first page is bounded to one row',
  pg_catalog.jsonb_array_length(public.azal_admin_customer_directory_page(null,1,0)->'rows')::text,'1');
select zz_eq('directory total is independent of page size',
  (public.azal_admin_customer_directory_page(null,1,0)->>'total'),'2');
select zz_eq('server-side search matches verified email',
  (public.azal_admin_customer_directory_page('c1@example.invalid',50,0)->>'total'),'1');
select zz_eq('server-side search matches phone',
  (public.azal_admin_customer_directory_page('6135550102',50,0)->>'total'),'1');
select zz_eq('server-side search matches member number',
  (public.azal_admin_customer_directory_page('10001',50,0)->>'total'),'1');
select zz_eq('directory page includes ledger-derived balance',
  ((public.azal_admin_customer_directory_page('c1@example.invalid',50,0)->'rows'->0)->>'balance'),'300');
select zz_eq('admin team list returns a structured member collection',
  (public.azal_admin_team_list() ? 'members')::text,'true');

\echo ===== Manager: branch-only operational view, no customer or money data
select public.azal_admin_team_assign('c1@example.invalid','Manager C1','manager',array['ottawa'],'T-14 test assignment');
select zz_eq('manager role is recognized',public.azal_is_manager()::text,'false');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false) \gset
select zz_eq('assigned Manager can access own branch',public.azal_manager_can_access('ottawa')::text,'true');
select zz_eq('Manager cannot access a different branch',public.azal_manager_can_access('second')::text,'false');
select zz_eq('Manager is not granted the Staff kitchen credential',public.azal_staff_can_access('ottawa')::text,'false');
select zz_eq('Manager operational RPC returns only its assigned branch',
  (select count(*)::text from pg_catalog.jsonb_array_elements(public.azal_manager_branch_orders('ottawa',50,0))),'1');
select zz_eq('Manager operational payload omits payment, tax, totals and PII',
  ((public.azal_manager_branch_orders('ottawa',50,0)->0 ? 'payment_status') or
   (public.azal_manager_branch_orders('ottawa',50,0)->0 ? 'tax_cents') or
   (public.azal_manager_branch_orders('ottawa',50,0)->0 ? 'total_cents') or
   (public.azal_manager_branch_orders('ottawa',50,0)->0 ? 'customer_email'))::text,'false');
select zz_eq('Manager cannot read Admin team directory',public.zz_try('select public.azal_admin_team_list()'),'42501');
select zz_eq('Manager cannot anonymize a customer',public.zz_try($$select public.azal_admin_anonymize_customer('00000000-0000-0000-0000-0000000000c2','no')$$),'42501');
reset role;

\echo ===== Admin: revoke named Manager access
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a0',false) \gset
set role authenticated;
select public.azal_admin_team_remove('00000000-0000-0000-0000-0000000000c1','T-14 test revoke');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false) \gset
set role authenticated;
select zz_eq('revoked Manager loses branch access immediately',public.azal_manager_can_access('ottawa')::text,'false');
reset role;

\echo ===== Pending team invite: no email sent; role applies only after verified Auth identity exists
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a0',false) \gset
set role authenticated;
select zz_eq('unregistered email creates pending in-portal invite',
  public.azal_admin_team_assign('future@example.invalid','Future Staff','staff',array['second'],'No email sent')->>'status',
  'pending_account');
reset role;
insert into auth.users(id,email) values ('00000000-0000-0000-0000-0000000000e2','future@example.invalid');
select zz_eq('unverified invitee has no role before email verification',
  (select count(*)::text from public.user_roles where user_id='00000000-0000-0000-0000-0000000000e2' and role='staff'),'0');
update auth.users set email_confirmed_at=pg_catalog.now() where id='00000000-0000-0000-0000-0000000000e2';
select zz_eq('verified invitee receives only the invited role',
  (select count(*)::text from public.user_roles where user_id='00000000-0000-0000-0000-0000000000e2' and role='staff'),'1');
select zz_eq('verified invitee receives only the invited branch',
  (select pg_catalog.string_agg(branch_slug,',') from public.staff_branch_access where user_id='00000000-0000-0000-0000-0000000000e2'),'second');

\echo ===== Branch Orders identity lifecycle
insert into auth.users(id,email,email_confirmed_at) values
 ('00000000-0000-0000-0000-0000000000e3','orders-ottawa@example.invalid',pg_catalog.now());
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a0',false) \gset
set role authenticated;
select zz_eq('Admin links one branch Orders identity',
  public.azal_admin_link_orders_account('ottawa','00000000-0000-0000-0000-0000000000e3','orders-ottawa@example.invalid')->>'status','linked');
select public.azal_admin_orders_password_audit('ottawa','requested','test reset');
select public.azal_admin_orders_password_audit('ottawa','completed','test reset');
select zz_eq('Orders identity cannot be removed as an ordinary team member',
  public.zz_try($$select public.azal_admin_team_remove('00000000-0000-0000-0000-0000000000e3','remove')$$),
  'orders_account_managed_separately');

\echo ===== A2 customer anonymization: identity scrub, membership suspension, financial history retained
reset role;
update public.orders set contact_phone='+16135550999',guest_name='Customer Two',guest_email='c2@example.invalid' where user_id='00000000-0000-0000-0000-0000000000c2';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a0',false) \gset
set role authenticated;

select zz_eq('customer anonymization requires a reason',
  public.zz_try($$select public.azal_admin_anonymize_customer('00000000-0000-0000-0000-0000000000c2','')$$),
  'reason_required');
select public.azal_admin_anonymize_customer('00000000-0000-0000-0000-0000000000c2','Customer requested account removal');
select zz_eq('customer profile name is scrubbed',
  (select coalesce(display_name,'∅') from public.profiles where id='00000000-0000-0000-0000-0000000000c2'),'∅');
select zz_eq('customer phone is scrubbed',
  (select coalesce(phone,'∅') from public.profiles where id='00000000-0000-0000-0000-0000000000c2'),'∅');
select zz_eq('member number is retired and not reused',
  (select member_number_retired::text from public.profiles where id='00000000-0000-0000-0000-0000000000c2'),'true');
select zz_eq('customer membership is suspended',
  (select status from public.memberships where user_id='00000000-0000-0000-0000-0000000000c2'),'suspended');
select zz_eq('points ledger remains append-only and retained',
  (select sum(delta_points)::text from public.points_ledger where user_id='00000000-0000-0000-0000-0000000000c2'),'700');
select zz_eq('order contact phone is scrubbed while the order remains',
  (select coalesce(contact_phone,'∅') from public.orders where user_id='00000000-0000-0000-0000-0000000000c2'),'∅');
select zz_eq('order guest name and email are scrubbed',
  (select (guest_name is null and guest_email is null)::text from public.orders where user_id='00000000-0000-0000-0000-0000000000c2'),'true');
select zz_eq('customer order and its financial snapshot remain',
  (select count(*)::text from public.orders where user_id='00000000-0000-0000-0000-0000000000c2'),'1');
select zz_eq('anonymized customer disappears from the directory',
  (public.azal_admin_customer_directory_page('c2@example.invalid',50,0)->>'total'),'0');
select zz_eq('anonymization is audited with actor and reason',
  (select count(*)::text from public.admin_audit_log where action='customer_anonymized' and target_id='00000000-0000-0000-0000-0000000000c2' and reason='Customer requested account removal'),'1');
reset role;

\echo ===== A1 1,000-customer scale fixture
insert into auth.users(id,email,email_confirmed_at)
select pg_catalog.gen_random_uuid(),'scale-'||g::text||'@example.invalid',pg_catalog.now()
from pg_catalog.generate_series(1,1000) g;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a0',false) \gset
set role authenticated;
select zz_eq('1,000-customer directory returns one bounded page',
  pg_catalog.jsonb_array_length(public.azal_admin_customer_directory_page(null,50,0)->'rows')::text,'50');
select zz_eq('1,000-customer directory reports the full count',
  (public.azal_admin_customer_directory_page(null,50,0)->>'total'),'1001');
select zz_eq('deep page remains bounded and correctly offset',
  pg_catalog.jsonb_array_length(public.azal_admin_customer_directory_page(null,50,950)->'rows')::text,'50');
select zz_eq('deep page reports requested offset',
  (public.azal_admin_customer_directory_page(null,50,950)->>'offset'),'950');
select zz_eq('search narrows 1,000-customer directory server-side',
  (public.azal_admin_customer_directory_page('scale-500@example.invalid',50,0)->>'total'),'1');
select zz_eq('authenticated cannot write the audit log directly',
  public.zz_try($$insert into public.admin_audit_log(actor_user_id,action,target_type,reason) values ('00000000-0000-0000-0000-0000000000a0','x','x','x')$$),'42501');
reset role;
