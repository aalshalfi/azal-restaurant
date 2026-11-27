# Apply 0007 — 10,000-point redemption increments

**Operator:** Muse (team lead) only. This document is not authorization to apply the migration.
**Migration:** `supabase/migrations/0007_points_increments.sql`.
**Depends on:** ordering schema 0001–0004 and `0006_points_redeem.sql`. Keep 0006 immutable.

## Binding policy

- 10,000 points = $10 off.
- 20,000 points = $20 off.
- 30,000 points = $30 off, continuing in 10,000-point increments.
- Any positive redemption must satisfy `points % 10000 = 0`.
- `discount_cents = points / 10`; the server independently enforces discount no greater than the server-priced subtotal.
- Balance is checked at placement and rechecked under the existing per-member payment lock. Points are debited only on successful payment.
- 5,000 points = $5 is rejected. Migration 0006 remains historical and is not edited.

## Apply sequence (staging only, lead-run)

1. Confirm the exact isolated staging Supabase project/ref and current migration history. Do not use production.
2. Confirm migrations 0001–0006 are applied in order. If 0006 is not applied, stop and apply it only as part of this same controlled sequence; do not expose the legacy 5,000-point tier to customers between 0006 and 0007.
3. Review the exact 0007 file SHA on the approved branch/PR.
4. Apply 0007 once. It updates `app_settings.redeem_tiers` to the single policy descriptor `10000:1000`, adds a guard against other values, and replaces the redemption helper/RPC response with a compact `step_points/cents_per_step/max_steps` descriptor.
5. Do not enable live payment or customer-facing rewards. Written accountant confirmation of HST treatment and reward liability remains outstanding.

## Read-only preflight

```sql
select current_database(),
       to_regclass('public.app_settings') is not null as has_settings,
       to_regclass('public.points_ledger') is not null as has_ledger,
       to_regprocedure('public.azal_redeem_cents(integer)') is not null as has_0006_helper,
       to_regprocedure('public.redeem_options()') is not null as has_0006_options;
```

All values must be true and the target must be the intended staging database.

## Post-apply verification

```sql
select value from public.app_settings where key = 'redeem_tiers';
select public.azal_redeem_cents(5000) as legacy_5k,
       public.azal_redeem_cents(9999) as points_9999,
       public.azal_redeem_cents(10000) as points_10k,
       public.azal_redeem_cents(19999) as points_19999,
       public.azal_redeem_cents(20000) as points_20k,
       public.azal_redeem_cents(29999) as points_29999,
       public.azal_redeem_cents(30000) as points_30k;
```

Expected: config `10000:1000`; null, null, 1000, null, 2000, null, 3000. Helper execution remains revoked from anon/authenticated.

As an authenticated member, verify `redeem_options()` returns only a compact descriptor (balance, step_points=10000, cents_per_step=1000, max_steps=20), not an unbounded tier array. Verify the client caps the choices at 20 and filters legacy 5,000-point data if an older 0006 response is encountered.

Run the full SQL chain, points behavior suite, two-session payment race, Node tests and browser checkout suite on the exact migration/client SHA. Include boundary evidence: 9,999→none; 10,000→$10; 19,999→$10 only; 20,000→$10/$20; 29,999→$10/$20; 30,000→$10/$20/$30; below-discount subtotal rejected; 5,000 legacy rejected.

## Not authorized / still blocked

- No migration has been applied by ChatGPT.
- No production DB change or live payment/reward activation.
- No HST/accounting sign-off is claimed. The existing post-discount HST calculation must be confirmed in writing by the accountant before live rewards/payment are enabled.
- Monthly points-liability reconciliation and payment-provider idempotency/recovery remain separate release gates.
- Muse owns migration application, merge, and release decisions.
