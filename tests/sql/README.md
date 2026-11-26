# Local SQL review tests (Claude)

Purpose: execute the staging migration on a real PostgreSQL 16 and test the three C-REV fixes (F1-R1 admin join, F1-R2 ledger exactly-once, F1-R3 profile trigger) plus client-role access, money constraints and grant hardening. 50 checks pass (50 PASS, 0 FAIL) on `chatgpt/p2-fix-final-20261126` at `7f30e3d` and on `d103a16`. An earlier "57" counted output lines, including section headers and notices.

Not the real platform: `supabase-stub.sql` only imitates roles (`anon`, `authenticated`, `service_role`), `auth.users`, `auth.uid()` and Supabase's default privileges. It does not cover PostgREST, GoTrue, the dashboard, JWT handling or real project settings. Treat a pass as evidence about the SQL, not about the live project.

Run (needs PostgreSQL 16 binaries and a throwaway cluster; never point this at a real database):

```
createdb azal_review
psql -d azal_review -v ON_ERROR_STOP=1 -f tests/sql/supabase-stub.sql
psql -d azal_review -v ON_ERROR_STOP=1 -f supabase/migrations/0001_azal_staging.sql
psql -d azal_review -t -A -f tests/sql/review-behaviour.sql | grep -E '^(PASS|FAIL|=====)'
```

Every line must start with `PASS`. The script inserts fixtures and leaves them, so use a fresh database per run. Test users use `*@example.invalid`.

## Ordering, payments and guest claims (0004)
Fresh DB, then stub + 0001 baseline + 0002 + 0003 + 0004, then `psql -t -A -f tests/sql/ordering-behaviour.sql` (every line PASS; 80 checks at the time of writing). The script switches payments_mode to test itself after asserting it ships off.
Concurrent same-key retry: run `tests/sql/ordering-concurrency.sql` in two sessions about 0.4 s apart on the same DB. The first prints `false`, the second waits for the lock and prints `true` (replayed), and exactly one order exists for that key.

## 0005 reservations (Claude)
- Apply chain: stub → 0001 → 0002 → 0003 → 0004 → 0005 (0005 is idempotent; tested applied twice).
- `reservations-behaviour.sql` on a fresh db: **53 PASS, 0 FAIL**. It covers fields and validation (phone required and normalised to +1, email, name), party 1–10, the 30-min grid, hours and dwell-before-close, 60-min lead, 30-day window, closures and closed weekdays, per-tick capacity, idempotent replay and conflict, rate limit, the outbox (guest confirmation + restaurant notice, cancellation), guest cancel by code + email, the host-stand lifecycle, RLS (staff-only reads), grants and `search_path=''`, and the table-only rule (no note/item/order/payment columns).
- Concurrency: run `reservations-concurrency-setup.sql`, then `-a.sql` in the background and `-b.sql` 0.4 s later. Two parties of 8 for 10 seats → A `confirmed`, B `slot_full`, exactly 1 booking.
