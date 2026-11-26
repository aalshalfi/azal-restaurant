-- AZAL staging: read-only verification queries (C-REV) — written by Claude, 2026-11-25
-- Target: Supabase project "azal" (ref nrnkhnmlgkjytyryinlj), staging only.
-- Run in the SQL editor by whoever holds access (Muse). Every query here is READ-ONLY (SELECT on catalogs).
-- Paste each result block into CLAUDE-REPLY.md/MUSE-REPLY.md under the matching query number; Claude reviews.
-- Do NOT run these as a substitute for the C-REV gate: apply nothing to the project until the gate passes.
-- Written against supabase/migrations/0001_azal_staging.sql on branch chatgpt/f1-p2-staging-schema-20261125-v2.
-- Claude cannot reach the project (no network, no credentials); nothing in this file has been executed by Claude.

-- Q1. Postgres version and timezone setting (info; business logic must use 'America/Toronto' explicitly)
select version() as pg_version, current_setting('TimeZone') as db_timezone;

-- Q2. Every public table has RLS enabled.
-- EXPECT after apply: 20 rows, rowsecurity = true for all. Any false is a blocker.
select c.relname as table_name, c.relrowsecurity as rowsecurity, c.relforcerowsecurity as forced
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;

-- Q3. All RLS policies. EXPECT: reads only on catalog/own/admin rows; the ONLY write policy is profiles_update_self_or_admin.
-- No INSERT/UPDATE/DELETE/ALL policy on orders, order_items, order_item_options, order_events, points_ledger,
-- payment_events, settlement_batches, payment_settlements, memberships, user_roles, staff_branch_access.
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname = 'public'
order by tablename, cmd, policyname;

-- Q4. Write-capable policies only (the short list to eyeball). EXPECT: exactly one row (profiles update).
select tablename, policyname, cmd from pg_policies
where schemaname = 'public' and cmd in ('INSERT','UPDATE','DELETE','ALL')
order by tablename;

-- Q5. Table-level privileges held by client roles. The migration (0001 at 7f30e3d) revokes INSERT, UPDATE, DELETE,
-- TRUNCATE on all public tables from anon and authenticated. EXPECT: ZERO rows. Any row means a default privilege
-- or a later table re-opened client writes (RLS would still block, but report it to Claude).
select grantee, table_name, string_agg(privilege_type, ',' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon','authenticated')
  and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')
group by grantee, table_name
order by table_name, grantee;

-- Q5b. Column-level write grants for client roles (table-level Q5 does not show these).
-- EXPECT: exactly one row: authenticated | profiles | display_name | UPDATE
select grantee, table_name, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and grantee in ('anon','authenticated')
  and privilege_type in ('INSERT','UPDATE')
order by grantee, table_name, column_name;

-- Q6. Function EXECUTE rights for client roles on every public function.
-- EXPECT: anon = false for all; authenticated = true only for azal_is_admin, azal_staff_can_access,
-- and (after P3) the guarded place_order / my_balance. Security-definer staff functions must be false for authenticated
-- unless they check roles inside. No function should be executable by PUBLIC.
select p.oid::regprocedure as function,
       p.prosecdef as security_definer,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by 1;

-- Q7. Security-definer functions must pin search_path. EXPECT: every row shows search_path in proconfig.
select p.oid::regprocedure as function, p.proconfig
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef;

-- Q8. F1-R1 (admin join). Human check: an admin with NO staff_branch_access row must be allowed.
-- In the version reviewed, the function INNER JOINs staff_branch_access before the admin test, so a branch-less admin
-- gets false (fail-closed lockout). EXPECT after P2-FIX: admin is decided from user_roles alone (e.g. EXISTS on
-- user_roles role='admin' OR EXISTS on staff access for the branch), with no unconditional join.
select pg_get_functiondef('public.azal_staff_can_access(text)'::regprocedure) as definition;

-- Q9. F1-R2 (ledger exactly-once). EXPECT after P2-FIX: three PARTIAL UNIQUE indexes on points_ledger(order_id), one each
-- for entry_type = 'earn', 'earn_reversal', 'redeem_refund' (v5.4 semantics), in addition to event_key unique.
select indexname, indexdef from pg_indexes
where schemaname = 'public' and tablename = 'points_ledger'
order by indexname;

-- Q10. F1-R3 (profile creation). EXPECT after P2-FIX: a trigger on auth.users AFTER INSERT calling a SECURITY DEFINER
-- function that inserts into public.profiles with ON CONFLICT DO NOTHING (one profile per user, safe to repeat).
select t.tgname as trigger_name, t.tgenabled, p.oid::regprocedure as function, pg_get_triggerdef(t.oid) as triggerdef
from pg_trigger t
join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
where n.nspname = 'auth' and c.relname = 'users' and not t.tgisinternal;

-- Q11. Constraints that carry the money rules. EXPECT: total_cents = subtotal_cents + tax_cents check,
-- unique (user_id, idempotency_key), CHECK tax_rate_bps between 0 and 3000, currency = 'CAD'.
select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where connamespace = 'public'::regnamespace and conrelid in ('public.orders'::regclass, 'public.points_ledger'::regclass)
order by 1, 2;

-- Q12. Seed/fixture sanity (info): branches and hours must be clearly fixture data until the owner supplies real hours.
-- EXPECT: no real address/phone; hours rows are fixtures. Tier C facts stay Pending owner.
select slug, active from public.branches order by slug;
select branch_slug, weekday, closed, opens_local, closes_local from public.branch_hours order by branch_slug, weekday;

-- NOT checkable from SQL (do in the dashboard/API, paste the result):
--  * Auth: public signups disabled (probe: an anonymous signup request must be rejected).
--  * The service-role key is not present in any repo file or in the front-end bundle.
--  * Row counts are zero in orders, order_items, points_ledger, payment_events (no real data, no payments in P2/P3).
