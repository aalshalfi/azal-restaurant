# AZAL P2 — isolated Supabase staging apply runbook

**Status: PREPARED ONLY — DO NOT APPLY YET.** This is an execution checklist, not authorization to run SQL.

## Target and hard gate

- Target project ref reported by Muse: `nrnkhnmlgkjytyryinlj`.
- Expected dashboard project: `azal`, Canada Central (`ca-central-1`), Free plan.
- Existing `yemen-gate` and `yemen-gate-staging` projects are hands-off.
- Apply only after (1) Claude posts the C-REV verdict on the exact corrected migration, (2) Muse approves the PR/merge and explicitly clears the staging apply gate, and (3) the project ref in the dashboard still matches exactly.
- Never paste a database password, service-role key, anon key, or connection string into GitHub or chat.

## 1. Preflight — stop if any check fails

1. Open Supabase Dashboard and verify the project ref is exactly `nrnkhnmlgkjytyryinlj`, name `azal`, region Canada Central, and plan Free. Do not use either Yemen Gate project.
2. Verify the latest `main` contains the reviewed migration and that Muse has recorded the C-REV and apply approvals. A draft PR or a passing static test is not approval to apply.
3. In the target project's SQL Editor, run this read-only inventory first:

```sql
select table_name
from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE'
order by table_name;
```

Expected for a new isolated project: no AZAL application tables already exist. If any of the names in the migration already exist, stop and ask Muse to reconcile; do not use `IF NOT EXISTS` as a reason to overwrite or assume the schema is correct.
4. Confirm no real users, orders, payments, menu data, or business hours have been entered. Do not delete anything to make the preflight pass.

## 2. Apply — one file, one transaction

After the gate is explicitly cleared:

1. Open the repository's reviewed `supabase/migrations/0001_azal_staging.sql` at the approved `main` SHA.
2. Copy the entire file into one new SQL Editor query. Do not split it into fragments or reorder statements.
3. Execute once. The file contains `BEGIN` / `COMMIT`; if any statement errors, stop and inspect the error. Do not retry by pasting only the failed fragment.
4. Record the applied main SHA, project ref, UTC/Toronto time, SQL Editor result, and operator in the team board/reply. Do not record secrets.

Alternative local operator path (only if the owner already has Supabase CLI configured for this exact staging project): use a local secret environment variable and `psql "$AZAL_STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0001_azal_staging.sql`. Never put the URL in a shell history, committed file, or chat transcript. Do not use `supabase db reset`.

## 3. Postflight — read-only verification

Run these queries and retain their non-sensitive output:

```sql
-- Expected application tables
select count(*) as expected_table_count
from information_schema.tables
where table_schema = 'public' and table_name in (
  'branches','profiles','user_roles','staff_branch_access','menu_categories',
  'menu_items','branch_menu_items','menu_item_option_groups','menu_item_options',
  'branch_option_prices','branch_hours','memberships','orders','order_items',
  'order_item_options','order_events','points_ledger','payment_events',
  'settlement_batches','payment_settlements'
);

-- Every application table must have RLS enabled
select c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and c.relname in ('branches','profiles','user_roles','staff_branch_access',
    'menu_categories','menu_items','branch_menu_items','menu_item_option_groups',
    'menu_item_options','branch_option_prices','branch_hours','memberships','orders',
    'order_items','order_item_options','order_events','points_ledger','payment_events',
    'settlement_batches','payment_settlements')
order by c.relname;

-- The three exactly-once indexes
select indexname from pg_indexes
where schemaname = 'public' and indexname in (
  'points_ledger_one_earn_per_order_idx',
  'points_ledger_one_earn_reversal_per_order_idx',
  'points_ledger_one_redeem_refund_per_order_idx'
) order by indexname;

-- Auth profile trigger
select tgname from pg_trigger
where tgrelid = 'auth.users'::regclass and not tgisinternal
  and tgname = 'azal_handle_new_user_after_insert';

-- Only the concept branch is seeded; no address or hours
select slug, name_en, name_fr, city, timezone, tax_rate_bps, active
from public.branches order by slug;
```

Expected: 20 application tables with RLS enabled; all three partial unique indexes; the `azal_handle_new_user_after_insert` trigger; and only the `ottawa` concept row. No hours, customer accounts, menu items, orders, ledger entries, payment events, or settlement rows are seeded.

## 4. Staging assertions

Only after postflight succeeds, run `supabase/tests/p2_fix_assertions.sql` as a single query. It uses synthetic `.invalid` identities, checks branch-less admin access, branch-scoped staff access, profile creation, and duplicate ledger rejection, then rolls back the test transaction. If it fails, stop; do not connect the website or enable signups.

## 5. Failure and rollback policy

- If the migration fails before `COMMIT`, the transaction should abort; capture the error and stop. Do not manually apply partial statements.
- If the migration committed but postflight or tests fail, do **not** drop tables, reset the project, or rewrite history. Keep the project isolated and ask Claude/Muse for a reviewed forward-fix migration.
- Do not wire Auth UI, public signup, order placement, staff operations, points, or payments as part of this apply. P2 schema foundation only.
- Do not apply this file to production or either Yemen Gate project.

— Prepared by ChatGPT; no database action performed.