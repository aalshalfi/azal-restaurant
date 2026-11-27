# AZAL P2-FIX — staging apply runbook

**Status: HISTORICAL — APPLIED 2026-11-26 05:35 EST. Do not re-execute.** This document is not authorization to run SQL.

> **Reconciliation note (lead, 2026-11-26 13:10 EST) — the apply in this runbook is COMPLETE, do not re-execute it.** 0001 + 0002 were applied 2026-11-26 05:35 EST on the verified-empty project (evidence: MUSE-REPLY.md 05:38, Q1–Q13 + Claude final live C-REV PASS); 0003 followed 06:05 and 0004 06:37, so live staging now holds 0001–0004. This runbook is now a **historical record** of that completed apply. The apparent contradiction with `docs/f1-review.md` ("Migration scope correction — existing staging baseline": do not re-run 0001) is a difference of moment, not of instruction: this runbook describes the empty-project apply, f1-review describes the post-apply state. The runbook's own STOP rule (if the project is not empty, do not apply 0001) already forbids re-execution against the live project. Merging PR #27 lands these sources on `main` for the record and the 0001→0005 chain only and applies **no SQL**. Any future migration apply needs a fresh exact-target runbook.

## Target and authority

- Isolated AZAL Supabase project ref: `nrnkhnmlgkjytyryinlj` (Muse-reported name `azal`, Canada Central, Free).
- Existing Yemen Gate projects remain hands-off.
- **Muse is the only person authorized to execute SQL in the project.** ChatGPT and Claude do not apply SQL.
- Apply order for the verified-empty project: **0001 baseline → verify → 0002 P2 fixes → verify**.
- Hard gates: (1) confirm exact project ref and sign-ups OFF; (2) run read-only baseline checks and confirm the project is empty; (3) Claude/Muse confirm the exact 0001 + 0002 files and expected outputs; (4) Muse explicitly clears the apply gate; (5) Muse applies 0001; (6) Muse runs Q1–Q13 and confirms the baseline state; (7) Muse applies 0002; (8) Muse reruns Q1–Q13 + Q5b; (9) Claude gives final live C-REV PASS/FAIL on the post-0002 outputs.

## Package B — verified-empty project only

The AZAL staging project was verified EMPTY at 23:01. Therefore the **full Package B sequence is required**:

1. Apply the complete baseline SQL from `docs/schema-reference/0001_azal_staging_baseline.sql`.
2. Verify the resulting baseline with the read-only checks in `docs/supabase-verify.sql` (Q1–Q13). Expected: the 0001 schema exists and the three known P2 defects remain visible.
3. Apply the complete `supabase/migrations/0002_p2_fixes.sql`.
4. Verify the fixed state with Q1–Q13 + Q5b and the approved assertion script.

**Do not skip 0001. Do not apply only 0002 to an empty project.** The 0001 file is the approved baseline for this specific verified-empty AZAL staging project; it is not a production migration and must never be applied to either Yemen Gate project or any non-empty/unverified project.

If the initial read-only checks show that the project is not empty or the project ref differs, STOP. Do not apply 0001 or 0002 until Muse and Claude reconcile the actual state and issue a revised, exact-target runbook. Do not use 0001 as a repair/reset script.

## 1. Preflight — read-only

1. Open Supabase Dashboard and verify the project ref is exactly `nrnkhnmlgkjytyryinlj`. Do not use either Yemen Gate project.
2. Confirm public sign-ups are OFF and email confirmation remains ON.
3. Run the read-only baseline queries in `docs/supabase-verify.sql`. Confirm the project is the verified-empty AZAL project: no AZAL application tables/schema objects from 0001, no customer accounts, orders, ledger events, payment events, or settlement rows. Capture all Q1–Q13 outputs.
4. If any AZAL application schema already exists, or any unexpected data is present, STOP. Do not apply 0001 and do not proceed with 0002.
5. Confirm the exact reviewed file revisions: `docs/schema-reference/0001_azal_staging_baseline.sql` and `supabase/migrations/0002_p2_fixes.sql` from the approved P2 branch/PR. Record their commit SHA values in Muse's reply. Never record secrets.

## 2. Apply 0001 baseline — Muse only

Only after the preflight is confirmed empty and Muse explicitly clears the gate:

1. Open the exact reviewed `docs/schema-reference/0001_azal_staging_baseline.sql`.
2. Muse copies the **entire 0001 baseline** into one new SQL Editor query and executes it once.
3. If any statement errors, stop and capture the error. Do not paste fragments, retry selectively, or move to 0002.
4. Record the project ref, exact source SHA, Toronto time, SQL Editor result, and operator. Do not record credentials or keys.
5. Run Q1–Q13 from `docs/supabase-verify.sql`. Confirm the 0001 baseline exists and the expected P2 defects are present:
   - Q2: AZAL application tables with RLS enabled.
   - Q4/Q5: the baseline's known broad client DML privileges are visible for review.
   - Q8: the branch-less-admin join defect is present.
   - Q9: the three per-order partial unique indexes are absent.
   - Q10: the Auth profile trigger is absent.
   - Q11/Q12: baseline constraints and fixture-only branch/hours are intact.
   - Q13: no real customer/order/ledger/payment data.
6. Paste every non-sensitive output block into `MUSE-REPLY.md`. Claude must confirm the exact baseline outputs before Muse proceeds.

## 3. Apply 0002 P2 fixes — Muse only

Only after the 0001 post-apply outputs are reviewed and Muse explicitly clears the second gate:

1. Open the exact reviewed `supabase/migrations/0002_p2_fixes.sql` from the approved P2 branch/PR.
2. Muse copies the **entire 0002 file** into one new SQL Editor query. Do not paste selected fragments.
3. Execute once. The migration contains its own transaction and preflight. If any statement errors, stop and capture the error; do not retry selectively or apply a partial patch.
4. Record the applied source SHA, project ref, Toronto time, SQL Editor result, and operator. Never record secrets.

## 4. Post-0002 verification — Q1–Q13 + Q5b

Muse reruns Q1–Q13 in `docs/supabase-verify.sql` and shares every non-sensitive output block with Claude. Also run this Q5b companion query because the migration deliberately uses a column-level grant:

```sql
select grantee, table_name, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and grantee in ('anon','authenticated')
  and privilege_type in ('INSERT','UPDATE','DELETE','REFERENCES')
order by table_name, grantee, column_name;
```

Expected after 0002:
- Q2: AZAL application tables remain present with RLS enabled.
- Q3/Q4: only the intended write policy remains (`profiles_update_self_or_admin`); no order, ledger, payment, membership, role, or branch-access write policies.
- Q5 table-level DML grants: zero rows for anon/authenticated.
- Q5b column-level privileges: exactly one row — `authenticated | profiles | display_name | UPDATE`.
- Q6: anon EXECUTE false for all public functions; authenticated EXECUTE only on the approved helpers present at this stage.
- Q7: every SECURITY DEFINER function has a pinned `search_path`.
- Q8: `azal_staff_can_access` decides admin from `user_roles` independently of `staff_branch_access`; staff remain branch-scoped.
- Q9: three partial unique indexes on `points_ledger(order_id)` for `earn`, `earn_reversal`, and `redeem_refund`.
- Q10: `auth.users` AFTER INSERT trigger calls the fixed-search-path SECURITY DEFINER profile function.
- Q11/Q12: existing money constraints and fixture-only branch/hours remain intact; no real address/phone/hours are introduced.
- Q13: no real customer/order/ledger/payment data.

After Q1–Q13 and Q5b, Muse may run `supabase/tests/p2_fix_assertions.sql` as one query. It uses synthetic `.invalid` fixtures and ends in `ROLLBACK`; it must not leave users, orders, or ledger rows. Claude reviews the pasted post-apply outputs and records final PASS/FAIL. P2 is not Done until that verdict is recorded.

## 5. Dashboard-only checks

From the bottom of `docs/supabase-verify.sql`, Muse also confirms: public signup remains disabled; no service-role key exists in the repository or front-end bundle; and there are zero real rows in orders, order_items, points_ledger, and payment_events. Never paste anon/service-role keys, passwords, or connection strings into GitHub or chat.

## 6. Failure and rollback policy

- If the initial preflight does not confirm the exact verified-empty project, STOP. Do not apply 0001 or 0002.
- If 0001 fails, stop; do not apply 0002. Capture the error and request a reviewed recovery plan.
- If 0001 succeeds but its Q1–Q13 outputs do not match the expected baseline, stop before 0002 and ask Claude/Muse to reconcile.
- If 0002's preflight fails or any statement errors before COMMIT, stop; do not paste fragments or apply partial statements.
- If 0002 commits but postflight or tests fail, do not drop tables, reset the project, or rewrite history. Keep staging isolated and ask Claude/Muse for a reviewed forward-fix migration.
- Do not enable signup, customer account creation, order placement, points accrual, payment processing, delivery, or real data collection as part of this P2 schema patch. Later features require their own reviewed migrations and Muse's separate gates.
- Never apply to production or either Yemen Gate project.

— Prepared by ChatGPT. Documentation only; no database action performed.
