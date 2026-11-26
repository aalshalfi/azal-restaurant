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
1. ~~Seat count~~ **Owner 22:37: "up to 50 people".** I read this as total seating capacity = 50 seats (assumption; if he meant the largest party, the model is unchanged but the seat count is still needed). Table layout still welcome. 2. ~~Dining time~~ **Owner 22:39: 60 minutes.** Slots every 30 min (my default), each holds seats for 60 min. 3. ~~Hours~~ **Owner 22:39: 11:00–21:00.** Days: provisional default every day (Muse ruling 22:43), config-driven, owner confirms. Last bookable slot 20:00 so the 60 min ends by 21:00. These are the only real hours; they go into `branch_hours` only after Muse records them from the owner. 4. Largest party accepted (my default until told: 10, larger groups send a request) and whether larger groups call instead. 5. ~~Deposit~~ **Owner: no deposit.** Still open: cancellation cutoff (my default: guest may cancel any time before the slot). 6. ~~Channel~~ **Owner: email.** Still open: the restaurant's receiving address and the sending account/service (owner-held, Tier C; I will not invent an address). Guest also gets a confirmation email. 7. Confirm authorization to go live (record in `MUSE-HANDOFF.md`).

## Build order
Spec (now) → owner answers → migration on staging (reviewed with my local PG harness) → staff reservations screen → guest page on a branch behind a feature flag → Muse live QA → owner approves go-live.


---
## Complete slot logic and edge cases (task 5, 2026-11-25 22:58)

**Parameters (config rows, not code):** seats 50; dwell 60 min; slot step 30 min; open 11:00, close 21:00; first slot 11:00; last slot 20:00 (dwell must end by close); party 1–10 online, 11+ shows "contact us" with the restaurant email (owner-supplied) and creates nothing; lead time minimum 60 min; booking window 30 days (my default, owner may change); cancel any time before the slot.

**Availability rule.** A booking occupies `party_size` seats for the half-open interval `[start, start+60min)`. A slot is bookable iff, for every 30-min tick in that interval, `sum(seats of active bookings covering the tick) + party_size <= 50`. Active = `requested` or `confirmed` or `seated`. Cancelled, no_show, completed free their seats (completed frees at actual end).

**Edge cases and the decision for each**
1. Two guests take the last seats at once: advisory lock on `(branch_id, service_date)`; the loser gets `slot_full` and the next three free slots offered.
2. Overlapping bookings that each fit a tick but together exceed it at a middle tick: the per-tick check above catches it (a start-slot-only count would not).
3. Party of 10 when 45 are seated: refused; suggest nearest slot with room.
4. Same guest books twice for the same slot: allowed if seats exist, but the confirmation shows "you already have a booking at this time" (soft warning, not a block).
5. Retry after network error: same idempotency key returns the same booking and code, never a second one.
6. Guest edits: cancel and rebook (one action, one email); no partial edit in v1, fewer steps.
7. Closed day/holiday: `branch_hours.closed` or a `closures` row removes all slots; existing bookings on that date are flagged for staff, not auto-cancelled (staff emails guests).
8. DST dates (next: Mar 14 2027 spring forward, Nov 7 2027 fall back): times are stored as `timestamptz`, judged in `America/Toronto`; slots built from local wall-clock, no 02:00 slot exists as hours are 11–21.
9. Walk-ins: staff can mark seats occupied (`walk_in` booking by staff) so online availability stays honest.
10. No-show: staff marks `no_show` 15 min after start; seats free; no fee (no deposit by owner order). Repeat no-shows are a Tier C policy question, not built.
11. Late arrival: table held 15 min (my default, config) then staff may release.
12. Abuse: rate limit per IP/contact (e.g. 5 attempts per 10 min, enforced server-side), no CAPTCHA initially; honeypot field. Captcha is a Tier C service decision if abuse appears.
13. Data: collect name + email (+ optional phone) only; 12-month retention then deletion (owner confirms; legal gate in launch-gates).
14. Pre-order link: optional `reservation_id` on a later order; a booking never requires an order.

## Email templates (EN/FR). Placeholders in {braces}. Sender, address and signature are owner-held; none invented.

**To guest — confirmation**
- EN subject: `Your table at AZAL is confirmed ({date}, {time})`
  Body: `Hello {name}, your table for {party} at AZAL is confirmed for {weekday}, {date} at {time}. We hold your table for 15 minutes after that time. Your reference: {code}. To cancel or change, use this link: {cancel_link}. We look forward to welcoming you.`
- FR objet : `Votre table chez AZAL est confirmée ({date}, {time})`
  Corps : `Bonjour {name}, votre table pour {party} chez AZAL est confirmée le {weekday} {date} à {time}. Nous la gardons 15 minutes après cette heure. Votre référence : {code}. Pour annuler ou modifier : {cancel_link}. Au plaisir de vous accueillir.`

**To guest — cancelled**
- EN: `Your AZAL booking {code} is cancelled. You are welcome to book again any time: {book_link}.`
- FR : `Votre réservation AZAL {code} est annulée. Vous pouvez réserver de nouveau à tout moment : {book_link}.`

**To guest — slot not available (no email, shown on screen)**
- EN: `That time is full. These are free: {slot1}, {slot2}, {slot3}.`  FR : `Cet horaire est complet. Ces créneaux sont libres : {slot1}, {slot2}, {slot3}.`

**To restaurant (language: EN default, owner may choose)**
- Subject: `New booking {code}: {party} on {date} {time}`
- Body: `{name} ({email}{, phone}) booked {party} for {date} at {time}. Seats left that hour: {seats_left}. Note: {note or "none"}.`
- Large-party request (11+): `Request, not a booking: {name}, {party} people, {date} {time}, {email}. Please reply to the guest.`

Language of the guest email = the language the guest used on the site when booking.
