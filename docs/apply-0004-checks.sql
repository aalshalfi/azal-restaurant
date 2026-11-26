\echo QA functions-anon
select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and has_function_privilege('anon', p.oid, 'execute') and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e') order by 1;
\echo QB functions-authenticated (0004)
select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('place_order','pay_order_test','staff_update_order','my_pending_claims','claim_guest_points') and has_function_privilege('authenticated', p.oid, 'execute') order by 1;
\echo QC search_path of 0004 functions
select p.proname, p.prosecdef, p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('place_order','pay_order_test','staff_update_order','my_pending_claims','claim_guest_points') order by 1;
\echo QD settings
select key, value from public.app_settings order by key;
\echo QE new tables RLS + client grants
select c.relname, c.relrowsecurity, (select count(*) from information_schema.role_table_grants g where g.table_schema='public' and g.table_name=c.relname and g.grantee in ('anon','authenticated')) as client_grants from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('app_settings','points_claims') order by 1;
\echo QF client DML on any public table (expect 0 rows)
select table_name, grantee, privilege_type from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') and privilege_type in ('INSERT','DELETE','TRUNCATE') order by 1,2,3;
\echo QG orders new columns
select column_name, is_nullable from information_schema.columns where table_schema='public' and table_name='orders' and column_name in ('user_id','pickup_slot','guest_name','guest_email') order by 1;
