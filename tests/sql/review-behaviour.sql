-- Independent C-REV behavioural tests (Claude, 2026-11-25). Runs on a LOCAL PostgreSQL 16 with tests/sql/supabase-stub.sql, NOT on the real Supabase project.
\set QUIET on
create or replace function public.zz_try(q text) returns text language plpgsql as $$ begin execute q; return 'ok'; exception when others then return sqlstate; end $$;
create or replace function public.zz_val(q text) returns text language plpgsql as $$ declare v text; begin execute q into v; return v; exception when others then return 'ERR:'||sqlstate; end $$;
create or replace function public.zz_eq(n text, got text, want text) returns text language sql as $$ select case when got is not distinct from want then 'PASS  '||n else 'FAIL  '||n||'  (got '||coalesce(got,'null')||', want '||want||')' end $$;
grant execute on function public.zz_try(text), public.zz_val(text), public.zz_eq(text,text,text) to anon, authenticated;

-- fixtures (as superuser)
insert into public.branches (slug,name_en,name_fr,city,tax_rate_bps) values ('gatineau','G','G','Gatineau',1300) on conflict do nothing;
insert into auth.users (id,aud,role,email) values
 ('00000000-0000-0000-0000-0000000000a1','authenticated','authenticated','a@example.invalid'),
 ('00000000-0000-0000-0000-0000000000b1','authenticated','authenticated','b@example.invalid'),
 ('00000000-0000-0000-0000-0000000000c1','authenticated','authenticated','admin@example.invalid'),
 ('00000000-0000-0000-0000-0000000000d1','authenticated','authenticated','staff@example.invalid'),
 ('00000000-0000-0000-0000-0000000000e1','authenticated','authenticated','norole@example.invalid');
insert into public.user_roles values ('00000000-0000-0000-0000-0000000000a1','customer'),('00000000-0000-0000-0000-0000000000b1','customer'),('00000000-0000-0000-0000-0000000000c1','admin'),('00000000-0000-0000-0000-0000000000d1','staff');
insert into public.staff_branch_access (user_id,branch_slug) values ('00000000-0000-0000-0000-0000000000d1','ottawa');   -- admin c1 deliberately has NO branch row
insert into public.orders (id,branch_slug,user_id,idempotency_key,request_hash,subtotal_cents,tax_rate_bps,tax_cents,total_cents) values
 ('10000000-0000-0000-0000-000000000001','ottawa','00000000-0000-0000-0000-0000000000a1','key-a-ottawa-000001',repeat('a',64),1000,1300,130,1130),
 ('10000000-0000-0000-0000-000000000002','gatineau','00000000-0000-0000-0000-0000000000a1','key-a-gatin-0000001',repeat('b',64),1000,1300,130,1130),
 ('10000000-0000-0000-0000-000000000003','ottawa','00000000-0000-0000-0000-0000000000b1','key-b-ottawa-000001',repeat('c',64),2000,1300,260,2260);

\echo ===== F1-R3 profile trigger =====
select zz_eq('R3 every auth user got a profile (5)', (select count(*)::text from public.profiles where id::text like '00000000-0000-0000-0000-0000000000%'), '5');
select zz_eq('R3 trigger is idempotent (profile pre-exists, no error)', (select zz_try($q$ with p as (insert into public.profiles(id) values ('00000000-0000-0000-0000-0000000000f1') returning 1) insert into auth.users(id,aud,role,email) values ('00000000-0000-0000-0000-0000000000f1','authenticated','authenticated','f@example.invalid') $q$)), 'ok');
select zz_eq('R3 exactly one profile row for that id', (select count(*)::text from public.profiles where id='00000000-0000-0000-0000-0000000000f1'), '1');
select zz_eq('R3 handle_new_user not executable by authenticated', has_function_privilege('authenticated','public.handle_new_user()','EXECUTE')::text, 'false');
select zz_eq('R3 handle_new_user not executable by anon', has_function_privilege('anon','public.handle_new_user()','EXECUTE')::text, 'false');

\echo ===== F1-R1 admin without branch row =====
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false) \gset
set role authenticated;
select zz_eq('R1 branch-less admin can access ottawa', public.azal_staff_can_access('ottawa')::text, 'true');
select zz_eq('R1 branch-less admin can access gatineau', public.azal_staff_can_access('gatineau')::text, 'true');
select zz_eq('R1 admin sees all 3 orders', public.zz_val('select count(*) from public.orders'), '3');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000d1',false) \gset
set role authenticated;
select zz_eq('R1 staff can access own branch ottawa', public.azal_staff_can_access('ottawa')::text, 'true');
select zz_eq('R1 staff cannot access gatineau', public.azal_staff_can_access('gatineau')::text, 'false');
select zz_eq('R1 staff sees only ottawa orders (2)', public.zz_val('select count(*) from public.orders'), '2');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000e1',false) \gset
set role authenticated;
select zz_eq('R1 user with no role cannot access', public.azal_staff_can_access('ottawa')::text, 'false');
select zz_eq('R1 user with no role sees 0 orders', public.zz_val('select count(*) from public.orders'), '0');
reset role;

\echo ===== RLS own-or-admin and client write blocks =====
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false) \gset
set role authenticated;
select zz_eq('A sees own 2 orders only', public.zz_val('select count(*) from public.orders'), '2');
select zz_eq('A cannot read B profile', public.zz_val($$select count(*) from public.profiles where id='00000000-0000-0000-0000-0000000000b1'$$), '0');
select zz_eq('A cannot INSERT order (client)', public.zz_try($$insert into public.orders(branch_slug,user_id,idempotency_key,request_hash,subtotal_cents,tax_rate_bps,tax_cents,total_cents) values ('ottawa','00000000-0000-0000-0000-0000000000a1','key-a-new-00000000001',repeat('d',64),100,1300,13,113)$$), '42501');
select zz_eq('A cannot UPDATE order', public.zz_try($$update public.orders set total_cents=1 where id='10000000-0000-0000-0000-000000000001'$$), '42501');
select zz_eq('A cannot DELETE order', public.zz_try($$delete from public.orders where id='10000000-0000-0000-0000-000000000001'$$), '42501');
select zz_eq('A cannot INSERT points_ledger', public.zz_try($$insert into public.points_ledger(user_id,event_key,entry_type,delta_points,reason) values ('00000000-0000-0000-0000-0000000000a1','x1','earn',500,'hack')$$), '42501');
select zz_eq('A cannot INSERT payment_events', public.zz_try($$insert into public.payment_events default values$$), '42501');
select zz_eq('A cannot self-promote (INSERT user_roles admin)', public.zz_try($$insert into public.user_roles values ('00000000-0000-0000-0000-0000000000a1','admin')$$), '42501');
select zz_eq('A can read only own roles (1)', public.zz_val('select count(*) from public.user_roles'), '1');
select zz_eq('A can update own display_name', public.zz_try($$update public.profiles set display_name='Ali' where id='00000000-0000-0000-0000-0000000000a1'$$), 'ok');
select zz_eq('A update of B display_name touches 0 rows', public.zz_val($$with u as (update public.profiles set display_name='x' where id='00000000-0000-0000-0000-0000000000b1' returning 1) select count(*) from u$$), '0');
select zz_eq('A cannot change anonymized_at (column grant)', public.zz_try($$update public.profiles set anonymized_at=now() where id='00000000-0000-0000-0000-0000000000a1'$$), '42501');
select zz_eq('A cannot change profile id', public.zz_try($$update public.profiles set id=gen_random_uuid() where id='00000000-0000-0000-0000-0000000000a1'$$), '42501');
select zz_eq('A can call azal_is_admin (false)', public.azal_is_admin()::text, 'false');
reset role;
set role anon;
select zz_eq('anon reads active branches', public.zz_val('select count(*) from public.branches'), '2');
select zz_eq('anon cannot read orders', public.zz_try('select 1 from public.orders'), '42501');
select zz_eq('anon cannot read profiles', public.zz_try('select 1 from public.profiles'), '42501');
select zz_eq('anon cannot execute azal_is_admin', public.zz_try('select public.azal_is_admin()'), '42501');
select zz_eq('anon cannot execute azal_staff_can_access', public.zz_try($$select public.azal_staff_can_access('ottawa')$$), '42501');
select zz_eq('anon cannot INSERT branches', public.zz_try($$insert into public.branches(slug,name_en,name_fr,city,tax_rate_bps) values ('x','x','x','x',1)$$), '42501');
reset role;

\echo ===== F1-R2 ledger exactly-once =====
insert into public.points_ledger(user_id,order_id,event_key,entry_type,delta_points,reason) values ('00000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-000000000001','earn:o1','earn',100,'test');
select zz_eq('R2 second earn for same order (different event_key) rejected', public.zz_try($$insert into public.points_ledger(user_id,order_id,event_key,entry_type,delta_points,reason) values ('00000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-000000000001','earn:o1:dup','earn',100,'dup')$$), '23505');
select zz_eq('R2 first earn_reversal accepted', public.zz_try($$insert into public.points_ledger(user_id,order_id,event_key,entry_type,delta_points,reason) values ('00000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-000000000001','rev:o1','earn_reversal',-100,'rev')$$), 'ok');
select zz_eq('R2 second earn_reversal rejected', public.zz_try($$insert into public.points_ledger(user_id,order_id,event_key,entry_type,delta_points,reason) values ('00000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-000000000001','rev:o1:dup','earn_reversal',-100,'dup')$$), '23505');
select zz_eq('R2 first redeem_refund accepted', public.zz_try($$insert into public.points_ledger(user_id,order_id,event_key,entry_type,delta_points,reason) values ('00000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-000000000001','rr:o1','redeem_refund',50,'rr')$$), 'ok');
select zz_eq('R2 second redeem_refund rejected', public.zz_try($$insert into public.points_ledger(user_id,order_id,event_key,entry_type,delta_points,reason) values ('00000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-000000000001','rr:o1:dup','redeem_refund',50,'dup')$$), '23505');
select zz_eq('R2 same event_key twice rejected', public.zz_try($$insert into public.points_ledger(user_id,order_id,event_key,entry_type,delta_points,reason) values ('00000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-000000000002','earn:o1','earn',100,'dupkey')$$), '23505');
select zz_eq('R2 earn with negative delta rejected (sign check)', public.zz_try($$insert into public.points_ledger(user_id,order_id,event_key,entry_type,delta_points,reason) values ('00000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-000000000002','earn:o2','earn',-5,'neg')$$), '23514');
select zz_eq('R2 earn on a different order still accepted', public.zz_try($$insert into public.points_ledger(user_id,order_id,event_key,entry_type,delta_points,reason) values ('00000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-000000000002','earn:o2ok','earn',100,'ok')$$), 'ok');
select zz_eq('R2 DB has no DELETE grant for authenticated on ledger', has_table_privilege('authenticated','public.points_ledger','DELETE')::text, 'false');

\echo ===== Money, idempotency, hardening =====
select zz_eq('M1 total != subtotal+tax rejected', public.zz_try($$insert into public.orders(branch_slug,user_id,idempotency_key,request_hash,subtotal_cents,tax_rate_bps,tax_cents,total_cents) values ('ottawa','00000000-0000-0000-0000-0000000000a1','key-bad-total-0000001',repeat('e',64),1000,1300,130,1000)$$), '23514');
select zz_eq('M2 tax_rate_bps 3001 rejected on branch', public.zz_try($$insert into public.branches(slug,name_en,name_fr,city,tax_rate_bps) values ('zz','z','z','z',3001)$$), '23514');
select zz_eq('M3 duplicate (user,idempotency_key) rejected', public.zz_try($$insert into public.orders(branch_slug,user_id,idempotency_key,request_hash,subtotal_cents,tax_rate_bps,tax_cents,total_cents) values ('ottawa','00000000-0000-0000-0000-0000000000a1','key-a-ottawa-000001',repeat('f',64),1000,1300,130,1130)$$), '23505');
select zz_eq('M4 idempotency key shorter than 16 rejected', public.zz_try($$insert into public.orders(branch_slug,user_id,idempotency_key,request_hash,subtotal_cents,tax_rate_bps,tax_cents,total_cents) values ('ottawa','00000000-0000-0000-0000-0000000000a1','short',repeat('f',64),1000,1300,130,1130)$$), '23514');
select zz_eq('M5 currency other than CAD rejected', public.zz_try($$insert into public.orders(branch_slug,user_id,idempotency_key,request_hash,subtotal_cents,tax_rate_bps,tax_cents,total_cents,currency) values ('ottawa','00000000-0000-0000-0000-0000000000a1','key-usd-0000000000001',repeat('f',64),1000,1300,130,1130,'USD')$$), '23514');
select zz_eq('H1 every security-definer function pins search_path', (select count(*)::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig,'{}')) c where c like 'search_path=%') and p.proname not like 'zz\_%'), '0');
select zz_eq('H2 no client write privileges on money/ledger tables', (select count(*)::text from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') and privilege_type in ('INSERT','DELETE','TRUNCATE') ), '0');
select zz_eq('H3 only UPDATE grant is profiles.display_name (column-level)', (select string_agg(table_name||'.'||column_name,',') from information_schema.column_privileges where table_schema='public' and grantee='authenticated' and privilege_type='UPDATE'), 'profiles.display_name');
\echo ===== done =====
