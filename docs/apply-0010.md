# Apply 0010 — a contact mobile on every order (T-02 / F-OWN-16)

**Operator:** Muse (lead) only. Staging only. Claude never runs SQL on the live project.
**Depends on:** 0006 (place_order with p_redeem_points) and 0008 (azal_phone), both live.
**When:** AFTER the T-02 PR is merged and deployed. The new checkout sends `p_guest_phone`. Until 0010 exists, the client retries once without it (a 404 from PostgREST). Once 0010 exists, guest orders **require** a mobile, so the client must already be live when it is applied.

## What changes
- `orders.contact_phone` (+E.164; NULL allowed for older orders and for members with no mobile).
- `place_order(..., p_guest_phone text default null)`:
  - a guest must send a valid mobile (`phone_required` / `invalid_phone`);
  - a member may send one for this order, otherwise the profile mobile is copied.
- The phone joins the idempotency hash only when one is sent.
- No new grants beyond `place_order`. Staff and owner read it through the existing RLS.

## 1. Preflight (read-only)
```sql
select current_database(), (select count(*) from public.orders) as orders,
       to_regprocedure('public.place_order(text, jsonb, timestamptz, text, text, text, text, integer)') is not null as has_0006_sig,
       to_regprocedure('public.azal_phone(text)') is not null as has_0008;   -- both true
```

## 2. Backup
Export `public.orders` and record its row count.

## 3. Apply
Run the file once. It is a single transaction and is safe to run twice.

## 4. Post-checks
```sql
select (select count(*) from public.orders) as orders,                                            -- unchanged
       to_regprocedure('public.place_order(text, jsonb, timestamptz, text, text, text, text, integer, text)') is not null as new_sig, -- true
       to_regprocedure('public.place_order(text, jsonb, timestamptz, text, text, text, text, integer)') is null as old_sig_gone,       -- true
       (select count(*) from pg_constraint where conname = 'order_contact_phone_e164') as phone_check;                                   -- 1
```

## 5. Acceptance (lead, live)
1. Place a guest order with a mobile.
2. Confirm the mobile appears on the staff ticket as a tap-to-call link.
3. Confirm "Join & collect these points" opens the join form with the order's email locked.

## Rollback
1. `drop function public.place_order(text, jsonb, timestamptz, text, text, text, text, integer, text);`
2. Re-run the `place_order` block of `0006_points_redeem.sql`, including its grants.

The column may stay.
