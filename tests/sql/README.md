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
- **Baseline sources (not on main yet):** 0001 and 0002 live on **PR #27** (`muse/p2-backfill` @ `181e967`). Exact blobs on that branch:
  - `docs/schema-reference/0001_azal_staging_baseline.sql`: blob `5e1cf437…`, sha256 `6d8c59706f875695…`
  - `supabase/migrations/0002_p2_fixes.sql`: blob `f4e9c68a…`, sha256 `8a9a1dd2300aa724…`

  Both are live on project `azal` (P2 closed). Load them from PR #27 until it merges.
- **Apply chain:** stub → 0001 → 0002 → 0003 → 0004 → 0005. 0005 is idempotent; it was tested applied twice.
- **`reservations-behaviour.sql`** on a fresh db: **61 PASS, 0 FAIL**. It covers:
  - the owner's six fields and validation (phone required, normalised to +1; plain email only — markup refused);
  - party 1–10; the 30-min grid; hours with the stay ending by close; 60-min lead; 30-day window; closures;
  - per-tick capacity; idempotent replay and conflict;
  - **throttles that changing the email does not get around:** per email 5/10 min, per mobile 5/h, per client IP 10/h (taken from `request.headers`; skipped only when no header is present);
  - cancel guessing: 5 per code and 10 per IP per 15 min, with attempts logged even on a miss (a miss returns `{status:'not_found'}` rather than raising);
  - the outbox; guest cancel; the host-stand lifecycle; RLS; grants; `search_path=''`; the table-only rule.
- **Concurrency (READ COMMITTED):**
  - Steps: run `reservations-concurrency-setup.sql`, then `-a.sql` in the background (it books 8 of 10 seats and holds its transaction 1 s), then `-b.sql` 0.4 s later (8 seats).
  - Result: B **waited ≈0.64 s on the branch-day lock**, then got `slot_full` — exactly 1 booking.
  - The same result holds with the helper forced to STABLE: the locked check is a new statement inside a VOLATILE function and takes a fresh snapshot. The helper is now VOLATILE anyway (belt and braces).
- **Throttle races (two sessions, READ COMMITTED; Muse/ChatGPT finding at `fc34f31`):**
  - Steps: run `reservations-race-setup.sql`. It leaves 9 bookings from IP `203.0.113.50` and 9 cancel guesses from IP `198.51.100.60`, each one below its limit. Then run `-book-a.sql` in the background and `-book-b.sql` 0.4 s later (likewise `-cancel-a/-b`). Each session holds its transaction for 1 s.
  - **Before the fix** (`fc34f31`): both bookings `confirmed` (11 from one IP, limit 10); both cancel guesses logged (11, limit 10). Race confirmed.
  - **After the fix:** A `confirmed` / B `rate_limited` (10 from the IP); cancel A `not_found` / B `rate_limited` (10 attempts).
  - The fix takes advisory locks on every throttle key **before** counting, in a fixed order: key → email → phone → ip → branch-day for booking, and ip → code for cancel. This avoids deadlock cycles.

