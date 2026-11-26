# P3 ordering-flow test design (C-TST) — Claude, 2026-11-25

Scope: P3 = a test order placed on staging flows cart → checkout → database → staff orders screen, with server-side hours, server-side HST 13%, idempotent submission, cursor polling that never misses an order. Written ahead of implementation so each case has a pass criterion before code exists. Semantics follow `docs/f1-architecture.md` and Yemen Gate v5.4 as described there.

**Assumptions I chose (silence = proceed; Muse or ChatGPT may overrule):**
- A1. HST is computed on the order subtotal (not per line), rounded half-up to the cent, and snapshotted on the order row.
- A2. Pre-orders while closed follow the Yemen Gate rule once hours exist; until the owner supplies hours, tests use a fixture branch with fixture hours (not real facts).
- A3. Points are out of scope until P4, but the exactly-once ledger indexes are tested now because P3 order completion will trigger them.
- A4. All times are `America/Toronto`.

## Environment rules (Tier C boundaries)

- Tests run only against the staging project and the local fake DOM. Never the public demo, never production data.
- Synthetic users only (`*@example.invalid`); no real customer data; no payments in P3 (payments come last, with owner approval).
- The owner holds all service credentials. Tests read them from environment variables, nothing is committed, and no test needs the owner key (use a staff test login and a customer test login).
- Every row a test creates carries a `test_run_id` tag in a note field or is rolled back in a transaction; the cleanup step is part of the test.

## Layer 1 — client, fake DOM (extend `tests/smoke.test.mjs`; runs in CI)

| ID | Case | Pass criterion |
|---|---|---|
| U1 | Cart totals display | Subtotal equals the sum of unit price x qty for 3 mixed items; the UI labels tax as "calculated at checkout", never a client-computed final. |
| U2 | Payload purity | The `place_order` call body contains item ids, option ids, quantities, branch, pickup time and idempotency key only. No price, no tax, no total. |
| U3 | Idempotency key lifecycle | One key per checkout attempt; a retry after a network error reuses the same key; a changed cart generates a new key. |
| U4 | Double submit | Two rapid clicks on "Place order" send one request; the button is disabled while pending. |
| U5 | Error mapping | Server errors `closed`, `item_unavailable`, `network` each show a distinct EN and FR message; the cart is preserved on every error. |
| U6 | Language and cart | Switching EN↔FR mid-checkout keeps cart, pickup time and typed name. |
| U7 | Quantity bounds | Quantity cannot go below 1 or above the configured cap from the UI; removing the last item empties the cart and disables checkout. |

## Layer 2 — database, SQL tests on staging (pgTAP or plain SQL in rolled-back transactions)

| ID | Case | Pass criterion |
|---|---|---|
| D1 | Server price list | Tampered payload with a client price of 0.01 still charges the `menu_items` price; the order row stores the server price. |
| D2 | HST math | Subtotals 12.99 → tax 1.69; 25.00 → 3.25; 0.01 → 0.00; 7.69 → 1.00 (7.69 x .13 = 0.9997); total = subtotal + tax exactly, no float drift (numeric type). |
| D3 | Tax snapshot | Changing the branch `tax_rate` afterwards does not change existing orders. |
| D4 | Idempotency | Calling `place_order` twice with the same `(user_id, idempotency_key)` returns the same order id and creates one row; a different key creates a second order. |
| D5 | Hours: open | An order inside `branch_hours` is accepted. |
| D6 | Hours: closed | An order outside hours, on a `closed` day (`branch_hours.closed = true`), and 1 second after closing is rejected with a stable error code; 1 second before closing is accepted. The schema allows `opens_local <> closes_local` with closing after midnight, so also test an overnight span (e.g. 11:00–01:00): accepted at 00:30, rejected at 01:30. |
| D7 | Hours: DST | On a spring-forward and a fall-back date, an order at the shifted wall-clock time is judged against Toronto local time, not UTC. |
| D8 | Invalid items | Unknown item id, inactive item, item from another branch, quantity 0, negative, or above the cap are each rejected; no partial order is left behind. |
| D9 | Lifecycle | The schema splits state into `fulfilment_status` (`placed, accepted, preparing, ready, handed_over, cancelled`) and `payment_status` (`unpaid, paid, refunded, voided`): staff can advance fulfilment in order; `handed_over` requires `handed_over_at` (check `handed_over_state_consistent`); `completed` in the Yemen Gate sense = paid AND handed over, so a points `earn` must not fire for an unpaid or cancelled order; cancelled/handed_over cannot be re-opened. |
| D10 | RLS: customers | Customer A cannot read, update or cancel customer B's orders; no client INSERT on `orders`, `points_ledger` or `payment_events`; no DELETE anywhere. |
| D11 | Function grants | `anon` and `public` cannot EXECUTE `place_order`, `complete_order`, `refund_order`; a customer cannot call staff functions. |
| D12 | Role safety | A staff user cannot change their own role; a branch-less admin still passes `azal_staff_can_access()` (regression for PR #4 must-fix F1-R1). |
| D13 | Profile creation | Creating an auth user produces exactly one profile row (regression for F1-R3); repeating the trigger does not duplicate it. |
| D14 | Ledger exactly-once | Completing an order twice yields one `earn` row (regression for F1-R2); a reversal yields one `earn_reversal`; both enforced by unique indexes, not by application code. |

## Layer 3 — staff reconciliation (the "never miss an order" gate)

| ID | Case | Pass criterion |
|---|---|---|
| S1 | Cursor correctness | 50 orders inserted with identical `created_at` and out-of-order ids are all returned exactly once by a cursor on `(created_at, id)`. |
| S2 | Gap on slow commit | Order A starts before B but commits after B; the poller still receives A on a later poll (the cursor design must tolerate late commits; if it cannot, the design must add a safety window and this case documents it). |
| S3 | Poll resume | After the staff screen is closed for 10 minutes and reopened, every order placed meanwhile appears once, newest-first display, with an audible/visible alert for unseen ones. |
| S4 | Duplicate suppression | The same order delivered by two overlapping polls renders one row. |
| S5 | Latency | A placed order appears on the staff screen within one polling interval (target set by Muse; record the measured value). |

## Layer 4 — end to end (Playwright against staging, test logins)

| ID | Case | Pass criterion |
|---|---|---|
| E1 | Happy path EN | Browse, add 2 dishes, sign in as test customer, choose pickup time, place order; order row exists with server totals; staff screen shows it. |
| E2 | Happy path FR | Same in French, confirmation text and dish names in French. |
| E3 | Mobile 390x844 | Same flow with the sticky cart; every step reachable without horizontal scroll; tap targets at least 44px. |
| E4 | Closed branch | The UI blocks or clearly offers pre-order; the server rejection is shown if the client check is bypassed. |
| E5 | Refresh mid-order | Reloading the checkout page keeps the cart; a repeated submit after reload creates no duplicate. |
| E6 | Signup probe | While public signups are disabled, an anonymous signup attempt is rejected (carried from Yemen Gate staging). |

## Priorities

P0 (merge blockers for P3): D1, D2, D4, D6, D8, D10, D11, S1, E1, U2, U3, U4. P1: the rest. Each case that fails on first implementation is expected; the point is a written bar. When a case is implemented, add its ID to the test name so `BOARD.md` can quote pass counts, and report them in the reply files with what was and was not run.

## What this cannot cover

No real payments, no real customer data, no load testing, no check of visual quality or real-device behavior. Those stay with Muse's live QA and the owner's real-world facts (hours, tax registration, menu prices).

---
# Full extension (task 3, 2026-11-25 22:59): accounts, points read, reservations

Same environment rules as above (staging only, synthetic `*@example.invalid` users, owner holds credentials, rows tagged and cleaned). IDs continue the series.

## Accounts (ACCT) — sign-up → profile → points read
| ID | Case | Pass criterion |
|---|---|---|
| A1 | Sign-up creates one profile | Creating an auth user yields exactly one `profiles` row with role `customer`; repeating the trigger adds none (F1-R3). |
| A2 | Role safety | A customer cannot set their own role or `member_since`; only `display_name` is updatable (column grant). |
| A3 | Profile privacy | Customer A cannot select customer B's profile or points. |
| A4 | Points read | `my_balance()` returns the sum of the caller's ledger rows only; a user with no rows gets 0, not null. |
| A5 | Ledger is append-only | No client INSERT/UPDATE/DELETE on `points_ledger` (privilege test, 42501). |
| A6 | Earn exactly once | Completing the same paid+handed-over order twice yields one `earn` row; unpaid or cancelled orders earn nothing. |
| A7 | Rate arithmetic | 10 pts per $1 on the subtotal before tax (decision pending at P4 checkpoint, test reads rates from config); $12.99 earns 129 pts (floor). |
| A8 | Signup disabled probe | While public sign-ups are off, an anonymous signup is rejected (E6). |
| A9 | Member page UI | `member.html` shows no balance and no forms until the schema is live; once live, balance shows only for the signed-in user; EN/FR keys complete (smoke test). |
| A10 | Sign-out | Sign-out clears local session state; cart survives sign-out; no personal data remains in `localStorage`. |
| A11 | Anonymous cart then sign-in | The cart built before sign-in is still there after sign-in (no lost steps). |

## Reservations (RS) — see `docs/reservations-spec.md` and `docs/reservations-schema.md`
RS1–RS18 as listed there. Priorities: P0 = RS3 and RS16 (no overbooking under race), RS4 (idempotent), RS6/RS12/RS13 (privacy and grants), RS11 (middle-tick overflow), RS1 (hours), RS10 (390px, targets ≥44px).
Additional UI cases: RS19 the booking form never asks for more than name, email, optional phone, optional note; RS20 the "11+ guests" path creates no booking and shows the owner-supplied contact email; RS21 confirmation shows the code and the cancel link; RS22 EN and FR confirmation and email templates contain no unfilled `{placeholders}`.

## Cross-feature
X1 One session, one language: switching EN↔FR on any page keeps the chosen language on every other page (multipage). X2 Cart, account state and a pending reservation draft survive a page reload. X3 Axe-style checks (labels, focus order, contrast) on Home/Menu/Story/Member/Reserve at 390px; no tap target under 44px (v3 currently fails this, see C-DES verdict).

## Counting rule
Each implemented case carries its ID in the test name. Reports quote `passed/total` for the implemented subset only and state what was not run.
