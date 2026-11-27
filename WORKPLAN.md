# AZAL — WORKPLAN.md

**The execution plan for SPEC v0.2.** Written by the team lead (Muse), 2026-11-27, on the owner's order: *every operation is defined completely before it is assigned — what it is, what it contains, and how it will be executed — so whoever receives it (Claude, ChatGPT, Copilot) receives a complete task, never a partial one.*

**The assignment rule (binding from this document on):** no task is assigned without a card in this format — **What** (one line + SPEC reference) · **Contains** (the full scope: files, behaviours, languages, states, edge cases) · **How** (branch, migrations, tests, evidence) · **Assignee** · **Depends on** · **Acceptance** (the exact ticks; a task closes only when all are ticked and lead-verified). If a builder finds a gap in a card, they stop and report the gap — they do not improvise around it.

Evidence standard for every delivery (professional-work standard, 2026-11-27): exact head SHA, CI run id, suite output lines, a pinning test per fix, and an explicit NOT-verified line, all in the builder's reply file the same cycle.

---

## PHASE A — Basics closed (SPEC steps 1–5)

### T-01 · Sign-out on every authenticated surface — SPEC step 1 · F-OWN-19 · Journey J9
- **What:** an admin or staff user can end their session from the page they are on; the session and all local state clear completely.
- **Contains:** a sign-out control on admin.html and staff.html (visible, labelled, EN/FR/AR); wired to AZALAuth.signOut; on completion the user lands on the member page signed out; local session storage fully cleared (no residue keys); the member page's existing sign-out verified working in the same pass; the control present in both shells' tests.
- **How:** Claude, branch `claude/sign-out-shells`. No migration. Browser tests pin: control exists on both pages, clicking it clears the session key and any cached account/overview state, and a subsequent visit to admin.html shows the signed-out state. Node + browser suites green.
- **Depends on:** nothing. **Acceptance:** J9 live by the lead (sign in as admin → sign out from admin.html → admin.html then refuses; same for staff).

### T-02 · Guest mobile + "Join & collect these points" action — SPEC step 2 · F-OWN-16
- **What:** guest checkout collects a required, validated mobile (the kitchen can call the customer), and the guest confirmation's join line becomes a real action.
- **Contains:** migration **0010** adding `p_guest_phone` to place_order + phone stored on the order (idempotent, applied by the lead after merge); checkout: required mobile field for guests with the same azal_phone validation as profiles, error text EN/FR/AR; signed-in members: profile phone pre-filled, editable for this order only; the phone shown on the staff ticket and in the customer's order detail; confirmation: a real button "Join & collect these points" opening the join flow with the order's email pre-filled and locked (guest adds name + mobile + password); on verified registration with that email the pending claim attaches exactly once (Proposal A mechanism, proven); the plain-text consequence line stays, now truthful.
- **How:** Claude, branch `claude/guest-phone-join`. Migration file + behaviour SQL; tests pin: phone required + validated + visible to staff; button renders only for guest orders; email locked to the order's email; claim attaches once. Lead applies 0010 after merge (preflight + assertions, the standing apply pattern).
- **Depends on:** T-01 merged (queue order only). **Acceptance:** lead places a guest order live with a phone, sees it on the staff ticket, and the join button opens the locked-email form.

### T-03 · Claimed guest orders enter the member's history — SPEC step 2 · F-OWN-18
- **What:** when a guest-points claim attaches, the member's claimed guest orders are linked to the account and appear in "Your orders" with full detail.
- **Contains:** a migration (0011, or an amendment inside the claim path if Claude's design shows it belongs there — his call, stated in the delivery) that, at claim time, sets orders.user_id for orders whose guest_email = the verified account email AND user_id IS NULL, exactly once; guest fields stay on the row for audit; points attach unchanged.
- **How:** Claude, branch `claude/claim-history-link`. Tests pin: link happens once; only for the claiming member's own email; never another member's orders; the #59 detail view renders a linked order.
- **Depends on:** T-02 (shares the claim path). **Acceptance:** lead re-runs the J3 pattern live: guest order → hand over → register → the order appears in history AND the points in the balance.

### T-04 · Member page to spec — SPEC step 3 · F-OWN-17
- **What:** the signed-in member page shows the member's own account first, in the password-first reality, with one points presentation.
- **Contains:** (1) signed-in state collapses the join pitch to a one-line Majlis header; (2) all copy updated to password-first (script.js authCodeTitle + memberIntro + member.html meta — no "join with your email" anywhere, EN/FR/AR); (3) identity line on the member card: name + email + phone (member number arrives with T-08 and slots into the same line); (4) ONE points presentation (the duplicate section removed); (5) plain-words economics on the page: 10 points per $1 · 10,000 points = $10 · founding members (first 100) earn +25% for life.
- **How:** Claude, branch `claude/member-page-spec`. No migration. Tests pin each of the five items per language where copy is involved. Owner's phone verdict closes the visual side.
- **Depends on:** nothing. **Acceptance:** lead walk as a signed-in member (Aziz account state) + owner verdict on his phone.

### T-05 · Password reset + truthful auth errors — SPEC step 3 · Journey J7
- **What:** a customer who forgets the password can reset it through the verified email flow, and auth errors tell the truth.
- **Contains:** "Forgot password" on the sign-in form (EN/FR/AR); Supabase reset flow with the redirect landing back on the member page; a set-new-password state on that page; wrong-password and unknown-email attempts show the same neutral, truthful message (no account-existence leak, per the 14:47 ruling); rate-limit behaviour stated in the delivery (platform-enforced vs client copy).
- **How:** Claude, branch `claude/password-reset`. No migration. Tests pin: the link renders, the reset request is issued with the correct redirect, the new-password state validates and saves, error copy is identical for wrong password vs unknown email.
- **Depends on:** nothing. **Acceptance:** J7 live by the lead in a clean browser (real reset email to a team-controlled address, wrong-password message captured verbatim).

### T-06 · Kitchen Reject with a required reason — SPEC step 4
- **What:** staff can reject a paid order with a reason the customer sees.
- **Contains:** a Reject control on the staff ticket (two-step: Reject → reason required → confirm); the reason stored with the order's audit trail (if a migration is needed it is 0012 — the delivery states which); the customer sees the rejection + reason in the order detail and in the order's status; EN/FR/AR; the action server-checked like every staff action (staff_update_order path); a rejected order leaves the open queue and appears in the day's closed view when T-09 exists (until then, it leaves the queue and stays in history).
- **How:** **Copilot** (issue assignment, BOARD claim registered by the lead BEFORE assigning — the lesson of the first session; session credits logged). Fallback: Claude. Tests pin: reason required (empty reason cannot submit), reason visible to the customer, audit event written, queue removal.
- **Depends on:** T-01. **Acceptance:** lead places an order, rejects it as staff with a reason, and reads the reason as the customer.

### T-07 · Copy & polish batch — SPEC step 5 · AUD-1..11, F-WALK-8/11/12
- **What:** one batch that closes every filed surface defect, so polish stops arriving one screenshot at a time.
- **Contains, item by item:** AUD-1 staging-stance copy reconciled (one coherent story, all surfaces + meta); AUD-2 dish deep-links (home cards + story "SEE IT ON THE MENU" land on the dish); AUD-3 sticky-bar bottom clearance all languages; AUD-4 language button names the language recognisably in FR; AUD-5 RTL mood arrows corrected; AUD-6 clear-cart control; AUD-7/F-WALK-8 place-order button never covers the card field (+ pinning browser test); AUD-8 no points lines for staff/admin sessions at checkout; AUD-9 branch name "Ottawa"; AUD-10 staff sigil block clarified (design: Claude); AUD-11 district line "Orléans, Ottawa" in the Visit block; F-WALK-11 itemised dish list above the totals in the checkout sheet; F-WALK-12 residuals (notices once per page; the dead EN/FR `items` strings removed from script.js — the former Copilot item).
- **How:** Claude, branch `claude/copy-polish-batch` (F-WALK-8's pinning test may be built by ChatGPT as a small task in parallel — one builder per file, BOARD claims first). No migration. One pinning test per item; the delivery lists items 1:1 against this card.
- **Depends on:** T-02/T-04 merged (shared files: checkout.js, member.html). **Acceptance:** lead re-walks the audit checklist live; every AUD item ticked or explicitly carried with a reason.

## PHASE B — Management depth (SPEC steps 6–9)

### T-08 · ADM-2: customer directory + all-status history + member number — SPEC step 6 · F-OWN-9/13
- **What:** the admin sees every customer and every order, and every membership has a human-readable number.
- **Contains:** a migration (0013) assigning a short, sayable member number once per membership (existing memberships backfilled, uniqueness enforced); admin customer directory (name, email, phone, member number, points balance, order count) via admin-only server path; admin order history: all statuses incl. handed_over and cancelled, filterable, with full per-order detail; the member's own identity line gains the number (the slot prepared in T-04); **a digital membership card on the member page (owner directive 2026-11-27 18:29): AZAL-branded card showing the member's name, the member number large and sayable, and a scannable barcode/QR generated client-side from the number alone (no server state, no data beyond what the member already sees) — the symbology is Claude's design-pass call, judged by one use case: a phone at the counter can scan it reliably. This un-parks the Issue #34 member-QR question: a scannable code WILL ship with this card.**
- **How:** Claude, branch `claude/adm-2`. Migration + behaviour SQL (incl. a second-user negative assertion); browser tests for directory/history rendering; RLS proof that customers cannot read the directory.
- **Depends on:** T-01, T-04. **Acceptance:** lead signs in as admin, finds the Aziz customer by number, opens his guest-linked order; J10's directory half ticks here.

### T-09 · Staff day view + identity line — SPEC §3.4 residuals
- **What:** the kitchen screen shows who is signed in, which branch, and the day's closed orders.
- **Contains:** identity + branch line on staff.html; a closed-orders section for today (handed over + rejected/cancelled, with times and actor); no change to the open-queue behaviour.
- **How:** Claude, branch `claude/staff-day-view`. No migration (existing events carry actor/time). Tests pin both sections.
- **Depends on:** T-01, T-06 (reject states exist). **Acceptance:** lead processes an order end-to-end and sees it in the closed view with the actor recorded.

### T-10 · Session policy — SPEC step 7 · F-OWN-12
- **What:** sessions end — by choice, by inactivity, and everywhere on demand.
- **Contains:** "remember me" as an explicit sign-in choice (without it, the session ends when the browser closes); inactivity auto-sign-out (24h customers, 8h staff/admin — config values); "sign out everywhere" in the account; sign-out clears the local session completely; the delivery states precisely which parts are platform-enforced vs client-enforced (Supabase refresh-token behaviour named, not hand-waved).
- **How:** Claude, branch `claude/session-policy`. No migration expected; if platform settings must change, they are listed for the lead to apply in the dashboard. Tests pin: no-remember session dies with the browser session; inactivity timer fires per role; sign-out-everywhere invalidates the other session's next request.
- **Depends on:** T-01, T-05. **Acceptance:** lead runs the three scenarios live in two browsers.

### T-11 · Customer email lifecycle on the outbox — SPEC step 8 · F-OWN-5/14
- **What:** every order state change produces the right customer email — queued truthfully, sent only when a sender exists.
- **Contains:** outbox events for placed / accepted / rejected-with-reason / ready / handed over (unique idempotency keys per order+event); branded EN/FR HTML + plain-text templates rendered from the persisted order (the #63 renderer pattern); the payload's order number aligned to the 6-char code + sigil; safe escaping; no card data, no unnecessary personal data; an email failure never changes the order; fake provider in CI; **sender stays OFF** (SMTP is the owner's launch step).
- **How:** ChatGPT (he built 0009), branch `chatgpt/order-email-lifecycle`. Migration 0014 if the events need schema (his delivery states it). Tests pin: one event per transition, payload correctness per state, templates render in EN/FR, sender-off default.
- **Depends on:** T-06 (rejection reason exists), T-02 (phone in payload where relevant). **Acceptance:** lead drives an order through all states in the DB and reads the five queued events with correct payloads; nothing claims "sent".

### T-12 · Admin outbox status view — SPEC §3.5
- **What:** the admin sees the email queue's truth: queued / blocked / failed / sent counts and the latest errors.
- **Contains:** an admin.html panel reading the outbox (admin-only path), counts by status, latest 10 events with state + error text; no send controls (sender is owner-gated).
- **How:** Claude or ChatGPT (whoever holds T-11's context — default ChatGPT, same branch family), small. Tests pin the panel renders from fixture rows.
- **Depends on:** T-11. **Acceptance:** lead sees the five J-events from T-11's acceptance listed as blocked/queued.

### T-13 · ADM-3: audited points adjustment — SPEC step 9
- **What:** the admin — and only the admin — can add or remove a member's points, with a reason, forever auditable.
- **Contains:** a dedicated adjustment entry type in the append-only points_ledger (never an edit of history); a SECURITY DEFINER RPC with locked search_path and a server-side admin check; a required reason + idempotency key; the adjustment visible in the member's own points history with its reason category; the admin UI inside the T-08 directory (adjust from the customer's row).
- **How:** Claude, branch `claude/adm-3`. Migration 0015 + behaviour SQL (non-admin rejected, duplicate key no-ops, ledger stays append-only). 
- **Depends on:** T-08. **Acceptance:** J6 — the lead grants the Aziz account to 10,000 points via ADM-3, the owner redeems at checkout on his phone.

### T-14 · ADM-4: staff & branch management — SPEC step 9
- **What:** the admin manages who is staff, for which branch, without touching the database by hand.
- **Contains:** invite/assign/revoke staff by email with role + branch; every change written to an audit trail with actor/time; revocation takes effect on the staffer's next request; the admin UI lists current staff per branch.
- **How:** Claude, branch `claude/adm-4`. Migration 0016 if the audit trail needs a table. Behaviour SQL pins: revoked staff loses access; non-admin cannot assign.
- **Depends on:** T-08. **Acceptance:** lead creates a throwaway staff account via the UI, sees the queue, revokes, sees access die.

### T-15 · ADM-5: inventory per branch — SPEC step 9 (may slip past Dec 8 — feasibility study)
- **What:** stock per branch/item with an honest movement log; sold-out items stop selling.
- **Contains:** stock quantities per branch/item (**no invented quantities** — initial values entered by the admin, defaulting to "not tracked" until set); manual adjustment with a required reason + immutable movement log; per-branch unavailable marking; server-side availability re-check at checkout; a configurable low-stock threshold shown in admin.
- **How:** Claude, branch `claude/adm-5`. Migration 0017 + behaviour SQL. Tests pin: checkout refuses an out-of-stock item; adjustments require a reason; the log cannot be edited.
- **Depends on:** T-08, T-14. **Acceptance:** lead marks an item out of stock as admin and watches checkout refuse it.

## PHASE C — Hardening gates (SPEC step 10; before any live payment)

### T-16 · Two-user PostgREST/RLS integration test — Journey J10
- **What:** proof, against the real staging API, that one customer cannot read another's data.
- **Contains:** two real accounts (the lead's test member + the admin as non-owner); the customer order-detail path queried for the other account's order must return nothing; profile/points/directory paths likewise; results recorded with the exact queries and responses.
- **How:** **Lead executes** (browser + SQL editor on staging), Claude supplies the assertion list from the #59/#62 SQL matrices. No code unless a leak is found — a leak becomes a P0 fix task on the spot.
- **Depends on:** T-08 (directory exists to be tested). **Acceptance:** the recorded run itself; J10 ticks.

### T-17 · Slot abandon/release + payment-retry idempotency
- **What:** a stranded unpaid order releases its pickup slot; a retried payment never double-charges or double-creates.
- **Contains:** server-side abandon/release for orders unpaid past a config window, with an audit event; payment retry after a lost response returns the original order (already_paid path verified under test); race coverage in the behaviour SQL.
- **How:** Claude, branch `claude/order-hardening`. Migration 0018 if needed. Tests pin both behaviours.
- **Depends on:** nothing (parallel-safe after Phase A). **Acceptance:** lead creates a stranded order in the DB and watches the slot free; double-submit of a payment returns one order.

## PHASE D — December & launch (SPEC step 11; owner-timed)

### T-18 · Real content swap (owner supplies, team executes)
- **Contains:** the real menu + prices (the premises' current menu, unchanged) replacing the sample; the 56 real photos wired to their dishes; hours set to the premises' current hours; the street address in the owner's released published form; sample/test labels removed in the same pass. **The seed is never re-run after this swap.**
- **How:** lead + Claude execute on the owner's data delivery; ChatGPT second-eyes the swap diff. **Depends on:** the owner's data. **Acceptance:** owner walks the live menu and confirms it is his real menu.

### T-19 · Launch sequence (owner's word at each gate)
- **Contains, in order:** custom SMTP for info@azalrestaurant.com + SPF/DKIM/DMARC verified → sender enabled → J8 reservations test → 0005 applied (lead, pinned SHAs + preflight + assertions) → booking flags on → azalrestaurant.com pointed at the site + Auth URLs updated → Stripe merchant connected by the owner → payments_mode to live → public launch 2027-01-01 (Facebook Page publish + Google listing the same week).
- **How:** the owner performs the account/DNS/merchant steps; the lead prepares each page and verifies each result. **Acceptance:** the owner's launch word.

---

*WORKPLAN v1.0 — Muse (team lead), 2026-11-27. Cards may be refined by the lead before assignment (refinements recorded in MUSE-REPLY.md); once assigned, a card changes only by a lead note naming the change. The plan executes only on the owner's reopening word, then strictly in phase order.*
