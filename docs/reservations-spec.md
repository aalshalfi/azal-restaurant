# Table reservation spec (R1) — Claude, 2026-11-25

Source: owner (via Riyad's suggestion, 22:34). Owner direction 22:35: the goal is a **complete, real site, not a demo**. This spec is written as a production feature. What stays gated is only what needs real-world facts or accounts the owner holds (Tier C). Until `MUSE-HANDOFF.md` records the owner's authorization (Muse to do; I may not edit that file), nothing here is switched on for the public.

## Guest flow (3 steps, mobile-first, EN/FR)
1. Party size, date, time (only slots that exist).
2. Name + phone or email (the only personal data collected; consent line shown).
3. Confirmation screen with a reference code; "add to calendar" link; cancel link.
Optional: "Pre-order for the table" jumps to the menu with the reservation attached (the "Sufra for N" idea). Not required for booking.

## Rules (decided by me unless the owner overrules)
- Capacity is counted in **seats per time slot**, not tables, until the owner gives a floor plan.
- Overbooking is prevented in the database: one function `reserve_table(...)` takes an advisory lock per branch+slot, checks seats left, inserts, returns a code. The client never decides availability.
- Idempotency key per attempt (same pattern as `place_order`); double submit creates one booking.
- All times `America/Toronto`, judged server-side against `branch_hours` (DST tested, like P3 D7).
- Status: `requested → confirmed → seated → completed`, or `cancelled` / `no_show`. Cancel by guest allowed until a cutoff the owner sets.
- Same security pattern as the orders schema: RLS own-or-admin, security-definer function with pinned `search_path`, explicit revoke from public/anon, append-only status history.
- Anonymous guests may book through the function only (rate-limited); no direct table access.

## Data model sketch (docs only, not a migration yet)
`reservations(id, branch_id, user_id null, guest_name, contact, party_size, slot_start timestamptz, status, code, idempotency_key, created_at)`, unique `(idempotency_key)`; `reservation_events(append-only)`; `slot_capacity(branch_id, weekday, seats, slot_minutes)`.

## Tests (C-TST, IDs RS1–RS10)
RS1 server rejects closed hours · RS2 party size bounds · RS3 two parallel bookings on the last seats: exactly one wins · RS4 idempotent retry · RS5 DST dates · RS6 anon cannot read others' bookings · RS7 function grants · RS8 cancel after cutoff refused · RS9 FR/EN confirmation text · RS10 390px flow, no horizontal scroll, targets ≥44px.

## Pending owner (Tier C — I will not invent any of these)
1. Seat count and, if possible, table layout. 2. Average dining time per party. 3. Real opening hours. 4. Largest party accepted and whether larger groups call instead. 5. Cancellation cutoff, no-show and deposit policy (deposit means real payments). 6. How the team is notified (email, SMS, staff screen) and from which owner-held account. 7. Confirm authorization to go live (record in `MUSE-HANDOFF.md`).

## Build order
Spec (now) → owner answers → migration on staging (reviewed with my local PG harness) → staff reservations screen → guest page on a branch behind a feature flag → Muse live QA → owner approves go-live.
