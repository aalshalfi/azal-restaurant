# Reservations schema draft (task 7) — Claude, 2026-11-25. DESIGN ONLY; ChatGPT implements as a P2 extension (migration `0003`, after the baseline decision). Nothing here is applied.

Follows the `0001` house style: RLS own-or-admin, security-definer functions with `set search_path = pg_catalog, public`, explicit `revoke … from public, anon` on every new function, no client INSERT/UPDATE/DELETE on tables, append-only history, `numeric`/`timestamptz`, no float. Parameters per `docs/reservations-spec.md` (50 seats, 60 min, 30-min step, party ≤10).

## Tables
```
reservation_settings(branch_id pk fk, seats int check(seats>0), dwell_minutes int default 60,
  step_minutes int default 30, max_party int default 10, min_lead_minutes int default 60,
  window_days int default 30, hold_minutes int default 15, updated_at)
reservation_closures(id, branch_id fk, closed_on date, reason text, unique(branch_id, closed_on))
reservations(id uuid pk, branch_id fk, user_id uuid null fk profiles, guest_name text not null,
  guest_email text not null, guest_phone text null, party_size int check(party_size between 1 and 20),
  starts_at timestamptz not null, ends_at timestamptz not null, status text not null default 'confirmed'
  check(status in ('requested','confirmed','seated','completed','cancelled','no_show')),
  source text not null default 'web' check(source in ('web','staff','walk_in')),
  code text not null unique, idempotency_key text not null, note text null,
  created_at, updated_at, unique(idempotency_key), check(ends_at > starts_at))
reservation_events(id, reservation_id fk, from_status, to_status, actor uuid null, at timestamptz default now())  -- append-only
```
Hours come from the existing `branch_hours` (local open/close, `closed`, overnight-safe as in D6); no duplicate hours table.

## Functions (all `security definer`, pinned search_path)
- `reservation_availability(branch uuid, day date, party int)` → set of `(starts_at, seats_left)`; executable by `anon, authenticated` (read-only, no personal data).
- `reserve_table(branch uuid, starts timestamptz, party int, name text, email text, phone text, note text, idem text)` → `(reservation_id, code)`. Steps: validate bounds/hours/closure/lead/window in `America/Toronto`; `pg_advisory_xact_lock(hashtext(branch||date))`; per-tick capacity check (spec rule); insert; insert event; return. Executable by `anon, authenticated` (guests need no account), plus rate limiting: count recent attempts by `guest_email` and request IP header passed by the edge function; refuse above the limit with a stable code. Error codes: `closed`, `slot_full`, `party_too_large`, `too_soon`, `too_far`, `rate_limited`, `invalid`.
- `cancel_reservation(code text, email text)` → cancels if status in (requested, confirmed) and before start; verifies code+email (guests without account); executable by `anon, authenticated`.
- `staff_set_reservation_status(id, to_status)` → staff/admin only (`azal_staff_can_access(branch)` inside), enforces the lifecycle (seated → completed; confirmed → no_show only after start+15 min; terminal states immutable).
- `staff_create_walk_in(branch, party, note)` → staff only.

## RLS
- `reservations`: SELECT own (`user_id = auth.uid()`) or staff of branch/admin; no client INSERT/UPDATE/DELETE (revoked at table level like `0001`).
- `reservation_events`: staff/admin select; no client writes.
- `reservation_settings`, `reservation_closures`: public select of non-sensitive columns through `reservation_availability` only; tables staff/admin-only; writes admin-only.
- Guests without accounts never read rows; they hold only the code+email pair.

## Privacy and risk notes
- Email/phone are personal data: owner-held retention policy (spec proposes 12 months), deletion job is a Tier C legal gate (see launch-gates).
- Code entropy: 8 chars from a 31-symbol alphabet (no 0/O/1/I/L) ≈ 40 bits, plus email check, so guessing a cancel is not practical; still rate-limit `cancel_reservation`.
- Email sending is outside SQL: a database webhook/edge function calls the owner's email service using an owner-held key (never committed). Failure to send must not roll back the booking; add `notified_at` and a retry flag.
- No PII in logs or in `payment_events`; no payments in this feature.

## Tests (to add to `docs/p3-test-design.md` full list)
RS1–RS10 from the spec plus: RS11 per-tick overlap (middle-tick overflow rejected); RS12 `anon` cannot select `reservations`; RS13 `anon` can execute only `reservation_availability`, `reserve_table`, `cancel_reservation`; RS14 staff cannot move a terminal status; RS15 cancel with wrong email refused with generic error (no enumeration); RS16 two-parallel-sessions race on last seats (run in the local PG harness with two connections); RS17 closure day returns no slots; RS18 DST 2027 dates.
