# P3 pickup-time step: guest-facing design (Claude, 2026-11-26). Docs only.

Approved by lead 00:25. This is the one screen between "Your order" and payment. Goal: the guest chooses when to collect in **one tap** in the normal case, and the server never accepts a time the kitchen cannot meet. Sources: `docs/p3-test-design.md` (D5–D7 hours/DST, U2–U5 payload and errors), owner facts (open 11:00–21:00, Toronto), reservations defaults (`docs/reservations-spec.md`).

## 1. Where it sits in the flow
Menu → cart drawer → **"Choose a pickup time"** (the launch label in `content-v3.md`) → this step → review & pay (later, owner-gated) → confirmation with code and time.
Sign-in comes before this step (ACCT: ordering on a signed-in identity). The cart is never lost if the guest backs out (E5, X2).

## 2. What the guest sees (390px first)
```
Pickup time                                   [×]
────────────────────────────────────────────────
(●) As soon as possible · ready about 12:35 pm
( ) Later today
     [12:45] [1:00] [1:15] [1:30]
     [1:45] [2:00] [Full] [2:30]   … show more
────────────────────────────────────────────────
Pickup at AZAL · {address when known}
[ Continue — $43.97 + tax ]
```
- **Default = "As soon as possible"**, pre-selected, with the computed ready time. Most guests tap Continue and are done.
- "Later today" expands a grid of 15-minute slots, 4 per row, each ≥44px. Shows the next 8, then "show more" (no endless scroll).
- Full slots stay visible but disabled with the word "Full" (not just greyed). The guest understands why a time is missing.
- No calendar, no date picker in v1. When the restaurant is closed, the step shows the **next opening day** only (see §4).
- Times are shown in Toronto time. If the device time zone differs, one muted line: "Times are Toronto time."

## 3. Rules (server-side, config values, not code)
| Parameter | Default (mine unless noted) | Owner? |
|---|---|---|
| Opening hours | 11:00–21:00, 7 days provisional (owner 22:39; days provisional per lead) | days: **Pending owner** |
| Prep time | 20 min | **Pending owner** (kitchen) |
| Slot step | 15 min | |
| Orders per slot | 6 | **Pending owner** (kitchen capacity) |
| First pickup | opening + prep (11:20) | follows prep |
| Last pickup | 20:45 (kitchen must finish before 21:00) | **Pending owner** |
| ASAP ready time | now + prep, rounded **up** to the next 5 min, and no earlier than first pickup | |
| Order-ahead window | today only when open; the next opening day when closed | |
| Large orders | > 20 items, or a Sufra for 8, adds 10 min to prep | owner may change |

The server computes everything. The client only displays the slots it is given and sends back the chosen `pickup_at` (or `asap: true`). U2 still applies: no price, tax or total in the payload.

**Capacity check** (same pattern as reservations): `place_order` takes an advisory lock on `(branch, slot)`, counts active orders in that slot, and refuses with `slot_full` when the count reaches the limit. ASAP orders take the earliest slot ≥ the ready time that has room, and the confirmation shows the actual time.

## 4. States
| State | What shows |
|---|---|
| Open, slots free | ASAP pre-selected + later slots. |
| Open, ASAP slot full | ASAP line shows the next free time ("ready about 1:05 pm"); nothing else changes. |
| Last orders passed (after 20:45) | "We’ve closed for orders today. Order now for pickup tomorrow from 11:20 am." with tomorrow’s slots. ASAP hidden. |
| Closed day / closure | Same as above, with the next opening day named ("Friday"). |
| Before opening | ASAP hidden; first slot 11:20 pre-selected; line "We open at 11 am." |
| Loading | Skeleton of 8 slot boxes, no spinner. The Continue button is disabled. |
| Network error | "We couldn’t load pickup times. Check your connection and try again." [Try again]. The cart is kept. |
| `slot_full` on submit (race) | Inline under the grid: "That time just filled up. Here are the next free times:" plus 3 slots. The selection moves to the first of them; the guest confirms again. Never auto-submits. |
| `closed` on submit | Same handling as "last orders passed". |

## 5. Copy (EN / FR; FR uses U+00A0 before `: ; ? !`)
| Key | EN | FR |
|---|---|---|
| pickupTitle | Pickup time | Heure de retrait |
| pickupAsap | As soon as possible · ready about {time} | Dès que possible · prêt vers {time} |
| pickupLater | Later today | Plus tard aujourd’hui |
| pickupFull | Full | Complet |
| pickupMore | Show more times | Plus d’horaires |
| pickupTz | Times are Toronto time. | Heures de Toronto. |
| pickupClosedToday | We’ve closed for orders today. Order now for pickup {day} from {time}. | Les commandes sont fermées pour aujourd’hui. Commandez maintenant pour un retrait {day} dès {time}. |
| pickupBeforeOpen | We open at {time}. | Nous ouvrons à {time}. |
| pickupLoadError | We couldn’t load pickup times. Check your connection and try again. | Impossible de charger les horaires. Vérifiez votre connexion et réessayez. |
| pickupRetry | Try again | Réessayer |
| pickupSlotFull | That time just filled up. Here are the next free times: | Cet horaire vient d’être complet. Voici les prochains horaires libres : |
| pickupContinue | Continue — {total} + tax | Continuer — {total} + taxes |
| pickupConfirm | Ready at {time}. Show code {code} at the counter. | Prêt à {time}. Montrez le code {code} au comptoir. |
Time format: EN `12:35 pm` (`en-CA`), FR `12 h 35` (`fr-CA`), from `Intl.DateTimeFormat` with `timeZone: "America/Toronto"`.

## 6. Accessibility
- The choices are one `role="radiogroup"` labelled by the title. ASAP and each slot are radios, so arrow keys work. Full slots are `aria-disabled="true"` with the word "Full" in the accessible name.
- A change of ASAP time or a `slot_full` message is announced in the existing `cartStatus` live region.
- Focus moves to the title when the step opens and returns to the cart button when it closes. Esc closes. The step is a dialog with `aria-modal`, like the current checkout modal.

## 7. Data contract (for ChatGPT, P3)
- `pickup_slots(branch uuid, day date)` → `[{starts_at timestamptz, remaining int}]`, plus `asap_at`, `status in ('open','closed_today','before_open','closed_day')` and `next_open_at`. Executable by `authenticated`. No personal data.
- `place_order(..., pickup_at timestamptz null, asap boolean, idempotency_key)` → returns `pickup_at` actually assigned. Errors: `closed`, `slot_full`, `too_soon`, `item_unavailable`. The same `idempotency_key` returns the same order (D4).
- Every rule in §3 lives in a `pickup_settings` row per branch, next to `reservation_settings`.

## 8. Tests to add (IDs continue `docs/p3-test-design.md`)
PK1 ASAP = now + prep rounded up to 5 min · PK2 ASAP never before first pickup · PK3 after 20:45 only tomorrow is offered · PK4 slot at limit is `Full` in UI and rejected server-side · PK5 two parallel orders into the last place in a slot: exactly one wins (advisory lock) · PK6 `slot_full` shows 3 alternatives and does not auto-submit · PK7 DST dates 2027-03-14 / 2027-11-07 slots correct in Toronto time · PK8 radiogroup keyboard: arrows move, Full skipped · PK9 EN/FR time formats · PK10 the payload carries no price/total (U2) · PK11 network error keeps the cart and the chosen time.

## 9. Pending owner (Tier C)
Prep time, orders per 15-minute slot, last pickup time, days open, address line for the pickup card. Until each is given, the defaults above run on staging only.
