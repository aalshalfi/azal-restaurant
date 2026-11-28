# Apply 0014 — admin-only customer email directory

**Operator:** Muse / authorised lead only. ChatGPT does not apply this migration.  
**Environment:** isolated AZAL staging only, after the T-08 code review. Do not run on production as part of this batch.

## Purpose

Adds `public.azal_admin_customer_directory()`, a read-only SECURITY DEFINER RPC that joins `public.profiles` to `auth.users` and returns exactly six fields: `user_id`, `display_name`, `phone`, `email`, `member_number`, `created_at`.

The function pins an empty `search_path`, checks `auth.uid()` and `public.azal_is_admin()` inside the function, excludes anonymized profiles and staff/admin accounts, and exposes no auth metadata or secrets. EXECUTE is revoked from PUBLIC/anon/authenticated, then granted only to authenticated callers (the internal admin check remains mandatory).

## Preflight

Confirm the target project is the intended AZAL staging project and that migrations 0001–0004, 0008 and 0013 are already applied.

```sql
select current_database();
select to_regprocedure('public.azal_admin_customer_directory()') as existing_function;
select column_name
from information_schema.columns
where table_schema='public' and table_name='profiles'
  and column_name in ('display_name','phone','member_number','anonymized_at')
order by column_name;
```

Expected: the function is absent before first apply; all four profile columns are present. Stop if the project or prerequisites do not match.

## Apply

Run `supabase/migrations/0014_admin_customer_directory.sql` once in the staging SQL editor. It is wrapped in a transaction and safe to re-run.

## Verify

```sql
select p.proname, p.prosecdef, p.proconfig, p.proargnames
from pg_proc p
where p.oid='public.azal_admin_customer_directory()'::regprocedure;

select
  has_function_privilege('anon','public.azal_admin_customer_directory()','EXECUTE') as anon_execute,
  has_function_privilege('authenticated','public.azal_admin_customer_directory()','EXECUTE') as authenticated_execute;
```

Expected: `prosecdef = true`; `proconfig` pins `search_path=""`; output names are exactly the six listed fields; anon execute is false and authenticated execute is true. Authenticated execute is not an authorisation grant by itself: the function rejects every non-admin caller internally.

Then run `bash tests/sql/run-one.sh tests/sql/admin-directory-behaviour.sql` on a fresh disposable PG16 test database built from the documented chain. This behaviour suite uses synthetic `example.invalid` accounts and verifies admin email visibility, customer/staff denial, anon denial, retained handed-over/cancelled orders, snapshots and events.

**Do not** enable sign-ups, change payment mode, expose auth schema grants, or apply this to production as part of 0014.
