# Apply 0006 — Majlis points at checkout (F-OWN-4)

**Operator:** Muse (the lead) only. Staging project only. Claude never runs SQL on the live project.
**Source:** `supabase/migrations/0006_points_redeem.sql`. Use the blob SHA recorded in the PR; if the file changed, stop.
**Depends on:** 0001–0004, which are live. 0005 (reservations) is independent: either order works.

## What changes
- **`orders`** gains `discount_cents` and `redeemed_points`, both defaulting to 0, so existing rows are unchanged.
- **The total check on `orders`** becomes `total = subtotal − discount + tax`, together with "discount only with points".
- **`app_settings.redeem_tiers`** is set to `5000:500,10000:1000`, which is the adopted Option B: 5,000 points = $5 off and 10,000 points = $10 off. It is inserted only if missing.
- **`place_order`** gains `p_redeem_points` (default 0), so the old client calls keep working.
- **`pay_order_test`** debits the points when the order is paid.
- **`staff_update_order`** returns the points if a paid order is cancelled, and awards points only on the amount actually paid.
- **New function `redeem_options()`**, for signed-in members only.

## 1. Preflight (read-only)
```sql
select current_database(), (select count(*) from public.orders) as orders,
       (select count(*) from public.points_ledger) as ledger_rows,
       (select value from public.app_settings where key = 'payments_mode') as payments_mode,
       to_regprocedure('public.place_order(text, jsonb, timestamptz, text, text, text, text)') is not null as has_0004,
       (select conname from pg_constraint where conrelid = 'public.orders'::regclass and pg_get_constraintdef(oid) like '%total_cents = (subtotal_cents + tax_cents)%') as old_total_check;
```
Expected:
- the staging project ref;
- `has_0004 = true`;
- `old_total_check` is not null. PG names it `orders_check` (local PG16). 0006 finds it by its definition, so the name does not matter.

## 2. Backup before commit
Export the rows that 0006 touches or depends on (CSV or `pg_dump --data-only -t`):
- `public.orders`
- `public.points_ledger`
- `public.app_settings`

Record the row counts in MUSE-REPLY.

## 3. Apply
Run the file once in the SQL editor. It wraps itself in one transaction (`begin … commit`) and is safe to run twice.

## 4. Post-checks
```sql
select (select value from public.app_settings where key = 'redeem_tiers') as tiers,                -- 5000:500,10000:1000
       (select count(*) from public.orders where discount_cents <> 0 or redeemed_points <> 0) as discounted,  -- 0
       to_regprocedure('public.place_order(text, jsonb, timestamptz, text, text, text, text, integer)') is not null as new_sig, -- true
       has_function_privilege('anon', 'public.redeem_options()', 'execute') as anon_can_read,      -- false
       (select value from public.app_settings where key = 'payments_mode') as payments_mode;       -- unchanged
```

## 5. Owner test (no SQL)
1. Sign in as a member, add a $55.97 order, and open checkout.
   - With fewer than 5,000 points, the Majlis points box shows the balance and "first reward at 5,000 points", with no option to pick.
   - With 5,000 points or more, "Use 5,000 points: $5.00 off" appears and the totals read −$5.00, then HST on $50.97.
2. Pay with 4242. The ledger shows one `redeem` row of −5,000 for that order.
3. Staff cancels the order. One `redeem_refund` row of +5,000 appears and the refund equals the amount charged.

## Rollback
Run these in a transaction:
1. `drop function public.place_order(text, jsonb, timestamptz, text, text, text, text, integer);`
2. Re-run the `place_order`, `pay_order_test` and `staff_update_order` blocks of `0004_ordering_functions.sql`, including its grants.
3. `drop function public.redeem_options(), public.azal_redeem_cents(integer), public.azal_redeem_tiers(), public.azal_points_balance(uuid);`

The two new columns may stay, since both default to 0.

Only drop the new total check and re-add the old one if no order has a discount. If any order already has a discount, **restore from the backup instead**.

## Not verified
- Accounting: HST is charged on the amount after the points discount (a reward the store funds itself). An accountant should confirm this treatment before real payments start.
- Real-money payments: none. `payments_mode` stays as it is now.
