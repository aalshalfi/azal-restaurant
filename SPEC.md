# AZAL — SPEC.md

**The single specification for the AZAL restaurant website.** Written by the team lead (Muse), 2026-11-27, from: the owner's directives (F-OWN-1..19), the team votes, Claude's study input (2026-11-27 17:20), the lead's completeness audit (2026-11-27 17:22), and the standing configuration record. **v0.2 (2026-11-27): ChatGPT's benchmark study folded in (§9 + acceptance lines in §3.1/§3.2); the 11-step build order is unchanged.**

**Rule of this document:** if it is not in the SPEC, it does not get built. If it is in the SPEC, it does not get forgotten. A step is done only when every line of its acceptance checklist is ticked and lead-verified live.

Status key: **HAVE** (built and source- or live-proven) · **PARTIAL** · **MISSING** · **OWNER** (an owner-held input, never a team gap).

---

## 1. The target (الراية)

AZAL's site is the online home of a real Yemeni restaurant in Orléans, Ottawa, launching under its own name on **2027-01-01** on the existing operation — **the menu and the operating hours stay exactly as the premises offers them today**; only the name and identity change.

A customer must be able to do six things flawlessly, in **EN / FR / AR**:

1. **Browse** the menu (names, descriptions, prices, dish stories).
2. **Order and pay for pickup** (guest or member; test mode until the owner connects real payments).
3. **Reserve a table** (table only — never a food order).
4. **Belong to Majlis** — join, earn points, use points, see history.
5. **Find and contact us** — address, hours, phone, map. *(Launch blocker; the address is OWNER-held until he releases its published form.)*
6. **Trust and recover** — sign out everywhere, reset a password, get confirmations, reach the restaurant about an order.

The restaurant must be able to run it: a kitchen queue for staff, role-based access, and an admin who oversees everything.

**"Done" means:** every visible control does its real job; every basic in §3 exists; no stale copy; and each journey in §5 has passed its named live test.

## 2. Standing rules

- **Completeness standard (Claude's rule set, adopted):** (1) every authenticated surface shows identity + sign-out, tested on the page itself; (2) a control that cannot work is not rendered — never styled as live; (3) every money figure comes from the server; Arabic prices are single LTR isolates; (4) every page passes 320px / 390px / 1280px in EN/FR/AR with no horizontal scroll; (5) async answers are discarded after sign-out or account switch; (6) every fix carries a test that fails without it; every delivery carries exact SHA + CI run id + a NOT-verified line; (7) no sync drops a script tag or translation key — checked page by page, key by key; (8) nothing is done until the lead's live walk ticks it; visual items need the owner's verdict.
- **Staging stance (one coherent story):** until launch the site is a working test kitchen — ordering genuinely works in test mode with the example menu. Copy must say one consistent thing everywhere (hero, notices, meta): opening January 1; test ordering open now. No line may contradict another surface.
- **Honesty:** never claim "sent" for a queued email; test/preview labels stay until the owner launches; no invented business facts (address, hours, oven times) — owner-held inputs are marked OWNER wherever they appear.
- **Money/security/publishing** decisions are the owner's alone (Tier C). Product/feature choices are the team's, by vote, under the decisive-vote rule.

## 3. Per-surface requirements

### 3.1 Visitor pages (home, menu, story, reserve, 404)
- One header arrangement, correct on desktop and mobile, EN/FR/AR — **HAVE** (#33/#45/#65; desktop awaiting the owner's verdict).
- Language control: a direct choice is preferred; the cycling button is **HAVE** (improvement candidate F-WALK-13, vote queue — not a blocker).
- Menu with names, descriptions, prices, pronunciation chips, add-to-order — **HAVE**.
- Menu search — **HAVE** (verified live in the audit). Dietary/allergen filters — **December content question** (needs real menu metadata; not a build step).
- Unavailable items are visibly marked and cannot be ordered; availability is re-checked server-side at placement — **HAVE** (branch availability + server pricing path).
- Dish stories + Yemen map — **HAVE** (map edge-crop polish F-WALK-14, polish step).
- Dish cards and "SEE IT ON THE MENU" deep-link to the dish itself — **MISSING** (AUD-2).
- Visit block: phone — **HAVE**; district line "Orléans, Ottawa" — **MISSING** (AUD-11); street address, hours, map — **OWNER** (December swap).
- Preview/test notices shown once per page — **PARTIAL** (F-WALK-12).
- Meta descriptions free of "Opening soon / Preview site" at launch — **PARTIAL** (launch copy pass).
- Sticky order bar never overlaps content — **PARTIAL** (AUD-3 / F-WALK-9).
- Mood-card arrows correct in RTL — **MISSING** (AUD-5).
- FR language button must name the language recognisably — **MISSING** (AUD-4).
- Photos: placeholders until the swap — **OWNER** (56 real photos held privately; alt text must match the dish, not the photo, meanwhile).

### 3.2 Checkout (order + pay for pickup)
- Itemised summary (lines, quantities, unit prices) above the totals — **MISSING** (F-WALK-11).
- Subtotal / points discount / HST / total exactly as the server computes — **HAVE**.
- Pickup time choice with real capacity — **HAVE** (slot abandon/release hardening is a pre-launch gate, §7).
- Guest: name + email + **mobile (required, validated)** — **PARTIAL**: name+email HAVE; mobile **MISSING** (F-OWN-16, migration 0010).
- Member: profile details pre-filled; phone editable for this order — **PARTIAL**.
- Kitchen note field — **HAVE**.
- Points redemption in 10,000-point steps — **HAVE** (0006+0007 live).
- Payment: test card now — **HAVE**; real provider — **OWNER** (last step, his word).
- Confirmation: code, sigil, pickup time, next steps — **HAVE**.
- Guest confirmation carries a real **"Join & collect these points"** action (email pre-filled and locked) — **MISSING** (F-OWN-16). The guest path states the points consequence plainly before the choice: points are recorded for the order's email and claimable on joining (benchmark line, §9).
- Place-order button never covers a field — **PARTIAL** (AUD-7 / F-WALK-8).
- Clear-cart control — **MISSING** (AUD-6).
- Points lines never render for staff/admin sessions — **MISSING** (AUD-8).
- Every error recoverable without losing the cart — **HAVE** (idempotent placement).

### 3.3 Customer account / Majlis (member.html)
- One sign-in door: password first — **HAVE** (#60 + 0008 live); email link for existing accounts only, never creating accounts — **HAVE** (lead ruling 2026-11-27 14:47).
- **Password reset** via the verified flow — **MISSING** (not in auth.js; found by Claude's study).
- Join form: name (single field — lead decision, §6), email, mobile, password, with email confirmation — **HAVE**.
- Signed-in state: the sales pitch collapses to a one-line Majlis header — **MISSING** (F-OWN-17).
- Identity line: name, email, phone, **member number** — **PARTIAL** (name only today; member number has no data model — ADM-2).
- ONE points presentation, with the rules in plain words: **10 points per $1 · 10,000 points = $10 · founding members (first 100) earn +25% for life** — **MISSING** (F-OWN-17).
- Copy matches the password-first reality (no "join with your email") — **MISSING** (F-OWN-17; script.js:21, :144).
- Edit my details (name, phone; email via Auth confirmation) — **HAVE**.
- Order history, never deleted, with full detail — **HAVE** (#59). Signed-in customers see each order's live status in its detail view — **HAVE** (#59 events).
- Guest points attach after sign-up with the same email — **HAVE** (proven 2026-11-27, 434 pts).
- Claimed guest orders also appear in the member's history — **MISSING** (F-OWN-18).
- Session policy: remember-me choice; inactivity sign-out (24h customers); sign-out everywhere; sign-out clears the local session completely — **MISSING** (F-OWN-12).
- Tier display (Guest / Companion / Honoured) and founding status — **MISSING** (P4 Majlis layer, Dec 3–5; earn bonuses not yet in the earn function).

### 3.4 Staff / kitchen (staff.html)
- **Sign-out control** — **MISSING** (F-OWN-19).
- Signed-in identity + branch shown — **PARTIAL**.
- Open paid queue by pickup time, with sigil and the guest's **phone (tap to call)** — **PARTIAL** (phone needs 0010).
- Accept / prepare / ready / hand over — **HAVE**.
- **Reject with a REQUIRED reason, shown to the customer** — **MISSING** (Copilot assignment; Claude takes it if Copilot stays blocked).
- Every action server-checked; branch-scoped — **HAVE** (27-assertion matrix).
- Closed-orders view for the day — **MISSING**.
- New-order alert — **PARTIAL** (0009 outbox live; sender **OWNER** — SMTP).
- Shorter staff session limit (8h inactivity) — **MISSING** (F-OWN-12).
- Sigil block reads clearly (icon + number + word) — **PARTIAL** (AUD-10, design review).

### 3.5 Admin (admin.html)
- **Sign-out control** + identity line — **PARTIAL** (identity HAVE; sign-out **MISSING**, F-OWN-19).
- Today's overview with real numbers — **HAVE** (live PASS 2026-11-27 16:54).
- Branch name rendered properly ("Ottawa") — **MISSING** (AUD-9).
- All-status order history with filters + full detail (ADM-2) — **MISSING**.
- Customer directory: name, email, phone, member number, points, orders (ADM-2) — **MISSING**.
- Audited points adjustment (ADM-3) — **MISSING**.
- Staff & branch management (ADM-4) — **MISSING**.
- Email outbox status view (queued / sent / failed) — **MISSING**.
- Inventory per branch (ADM-5, after ADM-4; no invented quantities) — **MISSING**.

### 3.6 Emails & notifications
- Account confirmation / email change / password reset (Supabase Auth) — **PARTIAL** (defaults live; branding at the SMTP step).
- Customer order emails: placed · accepted · rejected (with reason) · ready · handed over — **MISSING** (lifecycle slice on the 0009 outbox; fake provider in CI; sender off until SMTP).
- Restaurant NEW_ORDER alert to info@azalrestaurant.com — **PARTIAL** (0009 applied; payload order number to be aligned with the 6-char code + sigil in the lifecycle slice).
- Custom SMTP for info@azalrestaurant.com + SPF/DKIM/DMARC — **OWNER** (launch dependency).

### 3.7 Reservations
- Table-only flow: name, mobile, email, party size, date/time — **PARTIAL** (source built as 0005; NOT applied; page honestly closed).
- Confirmation email to the guest + notification to info@azalrestaurant.com — **MISSING** (needs the sender).
- Optional dish pre-selection as a NOTE under the adopted terms (prep starts only after the guest is seated; payment in-store only) — **MISSING** (migration after 0005; renumber at build).
- Staff visibility of bookings — **MISSING**.
- Go-live — **OWNER**.

## 4. Data & business rules (fixed; changes are owner decisions)

- **Tax:** HST 13% (Ontario). Points redemption reduces the taxable amount (ETA s.181; CRA 112537 / HQR0001829 / 114083 — decided 2026-11-27).
- **Points:** earn 10 per $1 of pre-tax amount actually paid, posted at paid + handed over. Redemption: minimum **10,000 points = $10**, in exact 10,000-point steps, server invariant (points % 10000 = 0; discount = points/10; ≤ subtotal). No expiry for member-earned points. Guest claims expire after 90 days.
- **Majlis (P4, Dec 3–5):** tiers by 12-month earn — Guest (0), Companion (3,000, +10% earn), Honoured (10,000, +20% earn); founding-100 +25% earn for life. Bonuses are decided but NOT yet in the live earn function.
- **Roles:** admin (info@azalrestaurant.com) controls everything incl. points; branch staff accept/reject/hand over only, own branch only, never points or balances. One sign-in door; the role opens the area.
- **Orders:** paid online only (test mode); no order without payment; the kitchen sees paid orders only; orders are never deleted.
- **Contact:** restaurant email info@azalrestaurant.com; phone +1 343-999-6199. Address: OWNER-held.
- **Backend:** Supabase project azal (nrnkhnmlgkjytyryinlj). Migrations applied: 0001–0004, 0006, 0007, 0008, 0009. Not applied: 0005 (gated). Next numbers: 0010 (guest phone).

## 5. Journeys & their named live tests (acceptance)

| # | Journey | Live test (account · device · language) |
|---|---------|------------------------------------------|
| J1 | Guest orders, pays, kitchen processes, guest is told the sigil | guest · lead browser · EN — PASSED 2026-11-27 (87F046, owner-confirmed receipt) |
| J2 | Member registers (name/email/phone/password), orders, earns | member · owner's phone · AR — PASSED 2026-11-27 (order 647BEB, 249 pts) |
| J3 | Guest order → hand over → register same email → points land | guest→member · lead DB + owner account · EN — PASSED 2026-11-27 (434 pts) |
| J4 | Admin signs in → lands in management, never the customer view | admin · lead browser · AR — PASSED 2026-11-27 16:54 |
| J5 | Staff processes an order end-to-end from the queue | staff · owner's phone · AR — PASSED 2026-11-27 (owner processed 87F046) |
| J6 | Member redeems points at checkout | member with ≥10,000 pts (via ADM-3 adjustment) · owner's phone · EN — PENDING ADM-3 |
| J7 | Wrong-password and password-reset flows show truthful errors | member · clean browser · EN — PENDING (reset build) |
| J8 | Reservation: book a table → confirmation email → staff sees it | guest · phone · FR — PENDING 0005 + sender (OWNER go-live) |
| J9 | Sign-out from every authenticated surface ends the session | admin + staff + member · lead browser · EN — PENDING F-OWN-19 |
| J10 | Second user cannot see another's order detail (RLS) | two accounts · lead browser · EN — PENDING (Dec-8 gate) |

## 6. Lead decisions recorded in this SPEC

- Registration keeps a **single name field** (built and working). A first/last split is cosmetic, was never an owner directive to the lead, and does not block anything; revisit only if the owner asks.
- The language control stays a cycling button until the F-WALK-13 vote; it is not a fix-batch blocker (AUD-4's label clarity is fixed inside the copy pass).
- Promotional point offers stay parked (owner, 2026-11-27) — post-launch backlog, no design now.

## 7. Build order (when the line reopens — one batch, step by step)

Each step closes only when its SPEC lines are ticked and lead-verified live.

1. **Sign-out everywhere** (F-OWN-19: admin + staff shells; verify member) + J9.
2. **Guest mobile + join action** (F-OWN-16, migration 0010) + claimed-orders-in-history (F-OWN-18).
3. **Member page to spec** (F-OWN-17: pitch collapse, one points block with plain-words rules, identity line, password-first copy) + **password reset** + J7.
4. **Reject with reason** (Copilot; fallback Claude).
5. **Copy & polish pass:** staging-stance reconciliation (AUD-1), deep links (AUD-2), sticky-bar clearance (AUD-3), language label (AUD-4), RTL arrows (AUD-5), clear-cart (AUD-6), place-order overlap (AUD-7/F-WALK-8), no points lines for staff/admin (AUD-8), "Ottawa" (AUD-9), sigil block clarity (AUD-10), district line (AUD-11), itemised sheet list (F-WALK-11), notices once per page (F-WALK-12).
6. **ADM-2** (history + directory + member number).
7. **Session policy** (F-OWN-12).
8. **Email lifecycle** on the outbox (sender off) + outbox status view.
9. **ADM-3** (audited points adjustment) → J6. Then **ADM-4**, then **ADM-5**.
10. **Hardening gates before any live payment:** two-user PostgREST/RLS test (J10), slot abandon/release, payment-retry idempotency.
11. **December (owner-timed):** real menu/prices/photos/hours swap; address published; SMTP; domain; Stripe (owner); 0005 apply + reservations go-live (owner); launch 2027-01-01 (owner's word).

## 8. Gap annex — every open item, mapped

F-OWN-12 → step 7 · F-OWN-16 → step 2 · F-OWN-17 → step 3 · F-OWN-18 → step 2 · F-OWN-19 → step 1 · F-WALK-8 → step 5 · F-WALK-9/AUD-3 → step 5 · F-WALK-11 → step 5 · F-WALK-12 → step 5 · F-WALK-13 → vote queue · F-WALK-14 → step 5 · AUD-1 → step 5 · AUD-2 → step 5 · AUD-4 → step 5 · AUD-5 → step 5 · AUD-6 → step 5 · AUD-7 → step 5 · AUD-8 → step 5 · AUD-9 → step 5 · AUD-10 → step 5 · AUD-11 → step 5 · password reset → step 3 · ADM-2 → step 6 · ADM-3 → step 9 · ADM-4 → step 9 · ADM-5 → step 9 · Reject → step 4 · 0005 + pre-selection → step 11 (OWNER-gated).

*SPEC v0.2 — Muse (team lead), 2026-11-27. Changes after v0.2 require a lead note in MUSE-REPLY.md naming the section changed and why.*

## 9. Benchmark annex (ChatGPT study, 2026-11-27 — adopted by the lead)

Seven real ordering/rewards experiences walked on their public surfaces (staff/admin interiors are not publicly inspectable — those lines are baseline operational design, and the study says so): **Say Cheese Pizza & Poutine** (Ottawa independent), **Al's Diner** (Ottawa independent), **Lorenzo's Pizza Carling** (Ottawa independent), **Denny's Canada**, **Chipotle Canada**, **Panera Bread Canada**, **CAVA** (US comparator). Full study + sources: CHATGPT-REPLY.md, 2026-11-27 benchmark section.

**What the benchmark confirms AZAL already meets or has specced:** identity/menu/stories; server-reconciled totals; guest + member paths with claimable guest points (J1–J3); plain-language earn/redeem clarity as a requirement (Al's Diner's always-visible rule banner is the clarity pattern — AZAL's economics stay as decided, §4); protected admin with real overview (J4); paid-only branch-scoped kitchen queue (J5); idempotent outbox with truthful delivery states (§3.6).

**Acceptance lines the benchmark added (folded into §3):** menu search (HAVE); a visible unavailable state with server-side re-check (HAVE); the guest points consequence stated before the guest/member choice (§3.2); customer-visible order status (§3.3).

**Explicitly NOT adopted:** delivery as a service mode (AZAL is pickup-only by the owner's rule — the comparators' delivery options do not apply); flexible reward catalogues or cash-equivalent redemption by imitation (the 10,000-point server invariant stands); any change to tier thresholds or to the build order.

**Vote-queue observations (no build, no vote requested now):** CAVA-style tier progression visibility (validates the decided P4 direction); a Chipotle-style visible reward exchange (post-launch consideration); independent-restaurant clarity patterns (searchable categories, dietary labels, out-of-stock labels, visible earn/redeem rule) — the clarity items are already inside §3 and step 5.
