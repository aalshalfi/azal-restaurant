# AZAL P2-FIX — staging apply runbook

**Status: PREPARED ONLY — DO NOT APPLY YET.** This document is not authorization to run SQL.

## Target and authority

- Isolated AZAL Supabase project ref: `nrnkhnmlgkjytyryinlj` (Muse-reported name `azal`, Canada Central, Free).
- Existing Yemen Gate projects remain hands-off.
- **Muse is the only person authorized to execute the migration in the project.** ChatGPT and Claude do not apply SQL.
- Hard gate order: (1) Claude static C-REV PASS on the exact 0002 patch; (2) Muse runs and shares baseline Q1–Q12 from `docs/supabase-verify.sql`; (3) Claude/Muse confirm the baseline and apply gate; (4) Muse applies 0002; (5) Muse reruns Q1–Q12 + Q5b; (6) Claude gives final PASS/FAIL on the post-apply outputs.

## Important: this is an incremental patch

The AZAL staging project already has the 0001 schema. Do **not** rerun the full 0001 baseline. The original 0001 SQL is preserved at `docs/schema-reference/0001_azal_staging_baseline.sql` for review only; it is not in the executable migrations directory.

The only file to apply is `supabase/migrations/0002_p2_fixes.sql`. It has a preflight guard requiring the existing profiles, roles, staff access, points ledger, orders, admin helper, and Supabase Auth tables. It contains no `CREATE TABLE` or `CREATE POLICY` statements. If its preflight fails, stop; do not try the baseline file.

## 1. Baseline checks — before applying anything

1. Open Supabase Dashboard and verify the project ref is exactly `nrnkhnmlgkjytyryinlj`. Do not use either Yemen Gate project.
2. Verify the project contains the expected AZAL 0001 schema. Do not expect an empty public schema; the existing schema is the baseline being reviewed.
3. Verify there are no real customer accounts, orders, ledger events, payment events, or settlement rows. Existing concept/fixture rows such as the Ottawa branch/hours may be present; do not delete or alter them.
4. Muse runs all Q1–Q12 in `docs/supabase-verify.sql` as read-only catalog queries and pastes the non-sensitive outputs into `MUSE-REPLY.md` for Claude.
5. Expected baseline: Q8 shows the branch-less-admin join defect; Q9 lacks the three per-order partial unique indexes; Q10 lacks the Auth profile trigger; Q5 shows the broad client DML privileges. Q2/Q4 must be reviewed for RLS/policies, Q6 for anon EXECUTE, and Q7 for pinned search paths. If any unrelated blocker appears, stop and ask Claude/Muse to reconcile before applying.

## 2. Apply — Muse only, one file, one transaction

Only after Claude's static C-REV PASS and Muse's explicit approval:

1. Open the reviewed `supabase/migrations/0002_p2_fixes.sql` from the approved PR #9/main SHA.
2. Muse copies the **entire 0002 file only** into one new SQL Editor query. Do not paste `docs/schema-reference/0001_azal_staging_baseline.sql`.
3. Execute once. The file contains `BEGIN` / `COMMIT` and a preflight guard. If any statement errors, stop and capture the error; do not paste fragments or retry selectively.
4. Record the applied main SHA, project ref, Toronto time, SQL Editor result, and operator in the team reply. Never record secrets.

## 3. Post-apply verification — Q1–Q12 + Q5b

Muse reruns all Q1–Q12 in `docs/supabase-verify.sql` and shares every non-sensitive output block with Claude. Also run this Q5b companion query because the migration deliberately uses a column-level grant:

```sql
select grantee, table_name, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and grantee in ('anon','authenticated')
  and privilege_type in ('INSERT','UPDATE','DELETE','REFERENCES')
order by table_name, grantee, column_name;
```

Expected after 0002:
- Q2: 20 AZAL application tables, all `rowsecurity = true`.
- Q3/Q4: only the intended write policy remains (`profiles_update_self_or_admin`); no order, ledger, payment, membership, role, or branch-access write policies.
- Q5 table-level DML grants: zero rows for anon/authenticated.
- Q5b column-level privileges: exactly one row — `authenticated | profiles | display_name | UPDATE`.
- Q6: anon EXECUTE false for all public functions; authenticated EXECUTE only on the approved helpers present at this stage.
- Q7: every SECURITY DEFINER function has a pinned `search_path`.
- Q8: `azal_staff_can_access` decides admin from `user_roles` independently of `staff_branch_access`; staff remain branch-scoped.
- Q9: three partial unique indexes on `points_ledger(order_id)` for `earn`, `earn_reversal`, and `redeem_refund`.
- Q10: `auth.users` AFTER INSERT trigger calls the fixed-search-path SECURITY DEFINER profile function.
- Q11/Q12: existing money constraints and fixture-only branch/hours remain intact; no real address/phone/hours are introduced.

After Q1–Q12 and Q5b, Muse may run `supabase/tests/p2_fix_assertions.sql` as one query. It uses synthetic `.invalid` fixtures and ends in `ROLLBACK`; it must not leave users, orders, or ledger rows. Claude reviews the pasted post-apply outputs and records final PASS/FAIL. P2 is not Done until that verdict is recorded.

## 4. Dashboard-only checks

From the bottom of `docs/supabase-verify.sql`, Muse also confirms: public signup is disabled; no service-role key exists in the repository or front-end bundle; and there are zero real rows in orders, order_items, points_ledger, and payment_events. Never paste anon/service-role keys, passwords, or connection strings into GitHub or chat.

## 5. Failure and rollback policy

- If the preflight guard fails or any statement errors before COMMIT, stop; the transaction should abort. Do not run the baseline file or apply partial statements.
- If 0002 commits but postflight or tests fail, do not drop tables, reset the project, or rewrite history. Keep staging isolated and ask Claude/Muse for a reviewed forward-fix migration.
- Do not enable signup, customer account creation, order placement, points accrual, payment processing, delivery, or real data collection as part of this schema patch.
- Never apply to production or either Yemen Gate project.

— Prepared by ChatGPT. No database action performed.