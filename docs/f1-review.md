# AZAL — F1 architecture review and P2 implementation decisions

**Reviewer:** ChatGPT  
**Date:** 2026-11-25 (Toronto)  
**Scope:** Review of `docs/f1-architecture.md` and a staging-only schema foundation.  
**Status:** Draft for Muse's two-eyes review. Not deployed or connected to a Supabase project.

## Executive decision

The P1 direction is sound at the product level: retain the static bilingual front end, use Supabase Auth/Postgres/RLS, keep money and points logic server-side, separate staging from production, and defer payment processing until the final owner-approved phase.

I would **not deploy the P1 note verbatim**. The schema needs clearer boundaries around branch-specific menu/pricing, order lifecycle, payment state, idempotency, staff scope, and ledger concurrency. The accompanying migration is a foundation, not a live ordering system; it deliberately contains no credentials, customer records, payment provider, live hours, real menu, or reward rates.

## Decisions to lock before implementation

1. **Separate order fulfilment from payment state.** Do not make a single status carry both meanings. Track fulfilment (`placed / accepted / preparing / ready / handed_over / cancelled`) separately from payment (`unpaid / paid / refunded / voided`). A completed paid-and-handed-over order is a derived condition. This avoids making cash/terminal reconciliation and future online payment mutually confusing.
2. **Branch owns sellability, price, tax and hours.** Keep a canonical bilingual dish record, but use a branch-menu join for availability, price, display order and branch-specific options. Snapshot the branch slug, tax rate and all displayed item/option names and prices onto order rows at placement. Use integer cents for all monetary values; do not use floating-point arithmetic.
3. **Treat idempotency as payload-bound and ledger writes as serialized.** A unique (user, key) is necessary but not sufficient: persist a request hash and reject reuse of the same key with a different payload. Award/reverse/redeem points only inside locked database transactions with unique source-event keys; never trust a client balance or a mutable `balance_after` as the source of truth.

## P1 architecture gaps / changes

- **Profile identity:** the no-FK profile choice can preserve records after Auth deletion, but it requires an explicit account-anonymization and re-registration policy. Never assume a deleted Auth identity can be silently reattached to the old profile. Keep financial/ledger rows independent of profile deletion.
- **Menu and branches:** the P1 note mentions menu items/options but does not specify branch-level availability or price. The migration adds `branch_menu_items` and branch-scoped option prices. This is necessary before a second branch exists; it avoids putting price on the global dish.
- **Order history:** snapshot bilingual item names, option labels and unit prices in order lines. A later menu edit must not rewrite an old receipt. Keep pickup as the only supported fulfilment type until the owner authorizes another.
- **State transitions:** use an append-only order event trail. Do not let a client update status columns directly. A future RPC must validate each transition, branch assignment, payment evidence and handover actor.
- **Tax:** snapshot `tax_rate`, taxable subtotal, tax and total in integer cents per order. The 13% Ottawa value is a current planning assumption from the owner context, not a tax engine for other provinces. A future second province needs tax-inclusive/exempt-item rules and rounding tests before launch.
- **Hours / scheduling:** store IANA timezone on each branch and hours as local wall-clock values. No hours are seeded. Do not accept scheduled pickup until owner-approved hours, lead time, cutoff and DST behavior are implemented and tested.
- **Membership:** `member` is a neutral account status, not a rewards tier. Do not expose earn/redeem controls until the owner decides rates, redemption value, expiry, reversals, eligibility and any tier rules.
- **Ledger:** append-only means database-enforced immutability, not a comment. Clients receive SELECT only; writes are future server RPCs. Balance is derived from the sum of signed entries. A materialized balance cache, if ever added, must be transactionally maintained and reconcilable.
- **Payments:** preserve audit metadata only. Never store PAN, CVV, payment credentials or raw provider payloads. No provider, webhook, settlement worker or charge path belongs in P2.
- **RLS and privileged functions:** every SECURITY DEFINER function must set a fixed `search_path`, qualify objects, revoke EXECUTE from `public`/`anon`, and grant only the intended role. Staff visibility must be branch-scoped, not global by default. Project-level signup disablement and Auth redirect settings are dashboard gates, not SQL guarantees.

## P2 schema foundation included in this branch

The migration creates:
- branches and branch hours (no invented hours);
- bilingual categories and menu items;
- branch-specific menu price/availability and option pricing;
- profiles, roles and branch-scoped staff assignment;
- memberships with no invented tier or points policy;
- orders, immutable item/option snapshots and order events;
- append-only points ledger and payment/settlement audit placeholders;
- RLS policies for public active-menu reads, own customer records and branch-scoped staff reads; no client write policies for orders, ledger, roles or payment audit.

The migration seeds only an Ottawa branch row at 13% HST. It does not seed hours, final menu/prices, users, rewards, or payment methods.

## Must be implemented before staging can accept an order

1. A server-side `place_order` RPC that validates branch/menu/option state, computes cents and tax, checks hours and pickup window, binds idempotency key to a canonical payload hash, snapshots all labels/prices, and creates order events atomically.
2. A strict transition RPC for staff acceptance/preparation/ready/handover/cancel/refund with role + branch checks and an audit event for every transition.
3. Payment evidence flow (cash/terminal only if owner authorizes; online provider later) with idempotent event ingestion and no client ability to mark paid.
4. Points RPCs only after Tier C policy is approved; award only after verified paid + handover, with reversal paths and concurrent duplicate tests.
5. Staging-only RLS/function tests, Auth signup-disabled probe, bilingual seed checks, concurrency/idempotency tests, DST/hours tests, and a real browser EN/FR desktop/mobile pass.

## Muse review requested

Please review this branch before any merge:
1. Challenge the lifecycle split and the branch-menu model. Is any required Yemen Gate invariant missing?
2. Inspect RLS, grants, and immutability assumptions in the SQL. Identify any privilege escalation or data leak.
3. Confirm whether the Ottawa branch seed should remain or be deferred until the owner creates staging.
4. Check that no unsupported policy, address, hours, final menu, prices, or customer data has been invented.
5. Do not deploy. This is a reviewable schema draft only.

## Verification limits

The repository does not contain the referenced private Yemen Gate v5.4 SQL file, so this review cannot claim line-by-line parity with that 1,209-line schema or its 14/14 + 29/29 suites. The SQL has not been run against PostgreSQL/Supabase because no owner-created staging project or local database target is available in this workflow. CI/browser QA and live deployment are not claimed.


## P2-FIX — remediation before staging apply (2026-11-25, Toronto)

The three lead-review blockers are addressed in the incremental `supabase/migrations/0002_p2_fixes.sql` patch for the existing AZAL staging schema:

1. **F1-R1 — branch-less admin access:** `azal_staff_can_access()` now returns true for an authenticated admin via `azal_is_admin()` independently of `staff_branch_access`; staff access remains branch-scoped through a separate `EXISTS` requiring role `staff` and the requested branch. Anonymous/null identity fails closed.
2. **F1-R2 — exactly-once ledger entries:** three partial unique indexes enforce at most one `earn`, one `earn_reversal`, and one `redeem_refund` per non-null `order_id`. `event_key` remains globally unique. No uniqueness rule is added for `redeem`, matching the v5.4 contract described in `docs/f1-architecture.md` (the actual private v5.4 SQL is not present in this repository, so byte/line parity is not claimed).
3. **F1-R3 — profile creation:** a fixed-search-path `SECURITY DEFINER` trigger function inserts only `(id)` into `public.profiles` after a new `auth.users` row. It does not copy user metadata or collect a display name. Direct EXECUTE is revoked from public/anon/authenticated; the trigger is the only invocation path.

The migration remains staging-only. `supabase/tests/p2_fix_assertions.sql` provides transaction-wrapped staging assertions for branch-less admin, branch-scoped staff, automatic profile creation from a synthetic `.invalid` Auth user, and duplicate ledger writes. `tests/p2-schema-static.test.mjs` guards the SQL structure in CI.

**Apply gate:** do not run this migration against any Supabase project until Claude posts C-REV and Muse explicitly clears the merge/apply gate. Muse has reported the isolated AZAL project ref `nrnkhnmlgkjytyryinlj` (Canada Central / Free); the existing Yemen Gate projects remain hands-off. The exact one-pass sequence is in `docs/p2-staging-apply.md`.

## Defense-in-depth privilege hardening (Claude C-REV Q5)

Added `REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated` before the 0002 patch's explicit least-privilege grants. The migration then grants the required public/authenticated SELECT rights and only `UPDATE(display_name)` on `profiles` to authenticated users. No client INSERT/DELETE/TRUNCATE or order/ledger/payment write grant is restored. This complements RLS and protects extension/future public tables from broad default DML privileges.

Post-apply proof is Q5 plus the Q5b companion query in `docs/p2-staging-apply.md`: Q5 table-level DML grants should return zero rows; Q5b column-level privileges should return exactly one row, `authenticated / profiles / display_name / UPDATE`. Q2–Q4 and Q6–Q10 remain part of Claude's C-REV evidence gate. Claude's `docs/supabase-verify.sql` Q5 expectation should be updated to reflect this distinction.

## Migration scope correction — existing staging baseline

The AZAL staging project already has the 0001 schema applied (Muse's Q1–Q12 baseline is intended to show the three current defects before the patch). Therefore **do not re-run the full 0001 schema**. The original baseline SQL is preserved at `docs/schema-reference/0001_azal_staging_baseline.sql` for review only and is not executable from the migrations directory. The only file to apply is `supabase/migrations/0002_p2_fixes.sql`, which has a preflight guard for the existing tables/functions and contains no table or policy creation.

Apply order is: Claude static C-REV → Muse runs baseline Q1–Q12 and shares outputs → Claude/Muse confirm gate → Muse alone applies 0002 → Muse reruns Q1–Q12 + Q5b → Claude gives final PASS/FAIL on outputs.