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
- **AMENDMENT (owner directive 2026-11-27 18:58, F-OWN-20 — same batch, same surface): the identity choice comes BEFORE the fields.** A signed-out customer opening checkout first sees three explicit options at the top of the sheet — **Sign in** · **Create an account** · **Continue as guest** — and the guest option states its consequence in one line before any field is shown (points for this order are held under the email and claimable on joining later with the same email; no points use or order history as a guest — the SPEC §9 benchmark line, stated before the choice). Choosing sign-in or create-account runs the auth flow and **returns to the open checkout with cart, pickup slot, and note intact** (pinning test). Signed-in customers never see the choice (the existing "Ordering as" line stands). EN/FR/AR; the choice renders at 320/390 without covering the pay control.
- **How:** Claude, branch `claude/guest-phone-join`. Migration file + behaviour SQL; tests pin: phone required + validated + visible to staff; button renders only for guest orders; email locked to the order's email; claim attaches once. Lead applies 0010 after merge (preflight + assertions, the standing apply pattern).
- **Depends on:** T-01 merged (queue order only). **Acceptance:** lead places a guest order live with a phone, sees it on the staff ticket, and the join button opens the locked-email form.

### T-03 · Claimed guest orders enter the member's history — SPEC step 2 · F-OWN-18
- **What:** when a guest-points claim attaches, the member's claimed guest orders are linked to the account and appear in "Your orders" with full detail.
- **Contains:** a migration (0011, or an amendment inside the claim path if Claude's design shows it belongs there — his call, stated in the delivery) that, at claim time, sets orders.user_id for orders whose guest_email = the verified account email AND user_id IS NULL, exactly once; guest fields stay on the row for audit; points attach unchanged.
- **How:** Claude, branch `claude/claim-history-link`. Tests pin: link happens once; only for the claiming member's own email; never another member's orders; the #59 detail view renders a linked order.
- **Depends on:** T-02 (shares the claim path). **Acceptance:** lead re-runs the J3 pattern live: guest order → hand over → register → the order appears in history AND the points in the balance.

### T-04 · Member page to spec — SPEC step 3 · F-OWN-17
- **What:** the signed-in member page shows the member's own account first, in the password-first reality, with one points presentation.
- **Contains:** (1) signed-in state collapses the join pitch to a one-line Majlis header; (2) all copy updated to password-first (script.js authCodeTitle + memberIntro + member.html meta — no "join with your email" anywhere, EN/FR/AR); (3) identity line on the member card: name + email + phone (member number arrives with T-08 and slots into the same line); (4) ONE points presentation (the duplicate section removed); (5) plain-words economics on the page: 10 points per $1 · 10,000 points = $10 · founding members (first 100) earn +30% for life.
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
- **How:** Claude, branch `claude/adm-3`. Migration version assigned after T21 under A5; the earlier 0015 placeholder is superseded by T14's migration 0015. Behaviour SQL (non-admin rejected, duplicate key no-ops, ledger stays append-only). 
- **Depends on:** T-08. **Acceptance:** J6 — the lead grants the Aziz account to 10,000 points via ADM-3, the owner redeems at checkout on his phone.

### T-20 · Admin order cancel + refund — owner directive 2026-11-27 18:30 (Phase B, after T-13)
- **What:** the admin — and only the admin — can cancel an order and refund its money from the admin panel, with the points consequences handled automatically and honestly.
- **Contains:** a Cancel action in the admin order detail (T-08 views): available at any state before hand-over, reason REQUIRED and shown to the customer, audit event with actor/time; a Refund action on any paid order: full refund per order — in test mode it records a test refund (payment_status → refunded + event), and its real-money execution activates only with the owner's Stripe connection (T-19), the control stating test mode plainly until then; **points integrity on cancel/refund, automatic and append-only:** the order's earn is reversed by a linked reversal entry (history is never edited), points the customer redeemed ON that order return to the balance by a reversal entry, and a pending guest claim tied to the order is voided; an order already handed over cannot be cancelled — refund-only, behind an explicit confirmation (goodwill); staff never see these controls (F-OWN-7: staff reject in the kitchen flow only; money powers are admin-only).
- **How:** Claude, branch `claude/admin-cancel-refund`. Next available migration after T13 if the refund state needs schema; Muse assigns the version before implementation (A5 sequence governs). Behaviour SQL pins: non-admin rejected; cancel without a reason rejected; earn reversal exactly once; redeemed points return exactly once; handed-over cancel rejected while refund succeeds.
- **Depends on:** T-08 (admin detail exists), T-13 (the audit pattern). **Acceptance:** the lead cancels a paid test order as admin and reads the reason as the customer; refunds a collected order and verifies the earn reversal and the returned redemption in the member's ledger.

### T-14 · ADM-4: team & access management — the UBER model, approved by the owner 2026-11-27 18:42 ("اوبر حرفيا" — ACCESS-PROPOSAL.md v2 + U1)
- **What:** access is managed exactly Uber's way: a Manager account with named users and roles, and a separate shared Orders account per branch whose password the Admin controls from the panel.
- **Contains:**
  - **Manager side (admin.html), a "Team" section:** named users added by NAME + EMAIL + role + branch (invite email; the person sets their OWN password via the verified flow; an email that already holds an account gets the role on that same account). Roles: **Admin** (the owner; SOLE manager of users and roles — only Admin adds/removes/changes users, per Uber's documented model and the owner's own rule; also sole holder of points/refunds/settings and of payment/tax data), **Manager** (operations: menu, hours, reports, inventory — never users/roles, points, refunds, settings, or payment/tax data), **Staff** (a named user who signs in at the one door and is routed to the kitchen screen). Edit role / resend invite / remove user from the same list — Admin only; removal kills access on the next request; every grant/change/removal is written to an audit trail with actor/time.
  - **Orders account (staff.html) — Uber's tablet account, U1 as approved:** ONE shared login per branch (its own username + password, distinct from every personal account), used on the kitchen device for the live queue only. **The account belongs to the BRANCH, not to any employee (owner clarification 2026-11-27 18:48): it is created with the branch, named for it, and stays unchanged as employees come and go.** The **Admin** views the branch's orders username and sets/resets its password from the Team section (Uber's Users → "Uber Eats Orders" tab pattern). Actions taken on it are stamped as the branch's orders account. Named Staff logins (above) open the same kitchen screen for branches that prefer per-person stamps — both doors exist, the branch chooses.
  - Nobody grants a role at or above their own; the owner/Admin account cannot be demoted or removed from inside the system; no staff or orders account ever touches points, refunds, other branches, or settings (server-checked, F-OWN-7).
- **How:** Claude, branch `claude/adm-4`. Migration 0015 (`supabase/migrations/0015_admin_team_access.sql`) for the Team/Access and A1/A2 schema/RPCs. The orders-account password mechanism is Claude's design within the stack (Admin sets/resets it from the panel; **no service key in the browser** — if a Supabase Edge Function is required, it is part of this card and is stated in the delivery). Behaviour SQL pins: revoked user loses access; Manager cannot grant Manager/Admin or touch points; the orders account reaches only its branch's queue; non-admin cannot assign anything.
- **Depends on:** T-08. **Acceptance:** the lead, as admin, adds a named Manager and a named Staff via the panel, resets the branch orders password, signs in on the kitchen screen with the NEW orders password, processes an order, then removes the Staff user and watches access die.

### T-21 · Admin menu manager — Uber Eats Manager-style (owner directive 2026-11-27 18:43; Phase B, after T-08)
- **What:** from the manager account, the owner manages the menu himself — exactly like Uber Eats Manager: products, names, photos, prices — no team member in between.
- **Contains:** an admin "Menu" section listing the branch's items with photo, names, price, availability; **add a product** (names + description/story + region in EN/FR/AR, price, photo, category); **edit** any of those fields on an existing item; **replace/upload a photo** (Supabase Storage bucket, admin-only write; the item references the stored image); **per-branch availability** (mark an item unavailable for the branch, incl. a "sold out today" state); **retire** an item (soft — order history keeps its snapshots; items are never hard-deleted); the public menu pages and checkout read from this same live catalog, so what the admin edits is what customers see and what the server prices (the static sample stays only as the labelled pre-swap state). Role scope per the approved access model: Admin full; Manager may edit the menu of his branch (Uber gives Managers the menu); Staff/orders account never.
- **Menu-structure decisions (lead, 2026-11-27, from the UBER-REFERENCE dossier — decided now so the card is complete before build):** **modifier groups are IN launch scope** (reusable groups: options, option prices, required/optional with min/max selection, attached per item, server-validated at order time — the real premises menu carries options and the December swap must not lose them); **menu-level and item-level hours are OUT** (one menu; the branch's operating hours govern); **per-item tax classes are OUT** (one HST rate per branch, already the model); **photo approval workflow is OUT** (the editor is the owner) — but the photo safety rules are IN: file type/size validated, the old image stays live until the replacement is committed, an item never renders a broken image URL. **Recorded exception to "Uber literally":** Uber lets Staff edit menus; AZAL's Staff and the branch Orders account never touch the menu — the owner's F-OWN-7 role law (staff = accept/reject/hand over only) governs over the Uber default.
- **How:** Claude, branch `claude/admin-menu`. Next available migration after T25/T26 if catalog fields/storage policies need schema; Muse assigns the version before implementation (A5 sequence governs). Tests pin: a non-admin cannot write the catalog or the bucket; an added item appears on the public menu and is orderable at the admin-set price; a retired item disappears from sale but its past orders still render.
- **Depends on:** T-08 (admin shell), T-14 (role scope). **Acceptance:** the lead, as admin, adds a test product with a photo, sees it live on the menu, orders it at the set price, then retires it. **T-18 changes accordingly:** the December real-menu swap is executed by the owner himself through this panel (team assists on request), with the 56 real photos loaded into the library.

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

### T-22 · Inline sign-in / join INSIDE the checkout sheet — F-OWN-21 (owner finding 2026-11-27 19:27; jumps ahead of T-04)
- **What:** at checkout, Sign in and Create an account happen **in the same place** — inside the checkout sheet. The customer never leaves his order for another page (owner: "مش بنفس المكان وهذا عيب كبير"), and Create an account actually opens the registration (today it opens nothing on desktop).
- **Contains:** the Sign in option expands the sheet into an email+password form in place; on success the sheet flips to the member state in place ("Ordering as {email}", profile phone prefilled, points/redeem available) and the customer pays without any navigation. The Create account option expands into the registration form in place (name, email, mobile, password — the F-OWN-1 fields); the email-verification step is handled truthfully in place per F-OWN-14 (if a confirmed session exists, member state applies at once; if confirmation is still pending, the sheet says so in plain words and offers sign-in in place — never a dead end, never a page change). Cart, pickup slot, and note are untouched throughout (they never leave the sheet). The guest path itself is unchanged, **but the guest form's "Have an account? Sign in instead" control must switch IN PLACE to the inline sign-in form (and back) — today that link does not open (owner, 19:27, laptop photo).** EN/FR/AR; sheet scrolls correctly at 320/390 and desktop widths with the forms open. **The T-02 stash-and-return navigation mechanism is removed** (superseded by this card).
- **How:** Claude, branch `claude/checkout-inline-auth`. Tests pin: sign-in completes without a page navigation (URL unchanged, sheet state flips); join form opens and submits from the sheet; wrong password shows its error in the sheet; guest path untouched; no navigation occurs for any of the three choices.
- **Depends on:** T-02 (merged). **Acceptance:** the lead live-tests all three choices on the published site — sign in as a member and pay in place; create an account from the sheet; guest as before — on desktop and phone widths. T-04 waits for this card.

### T-23 · Membership card, first pass (read-only) — from ChatGPT's proposal, lead-adjudicated 2026-11-27 20:15
- **What:** a premium AZAL membership card at the top of the signed-in member page: real display name, real points balance, the redemption rule stated accurately (10,000 points = $10), a View-rewards action to the existing rewards area. Read-only; no checkout, payment, ledger, or redemption changes.
- **IDENTITY LAW (owner, 2026-11-27 20:08: "يهمني نحافظ على الهويه"):** the card is built ONLY from the official brand package — exact palette (#42220E / #CD8E2D / #914820 / #F8F1E7), the official Arabic wordmark, the brand's own geometry/motifs. No burgundy (not in the palette), no invented patterns, no redesigned logo. Claude's design verdict on the card is binding (his seat), given on his return.
- **MEMBER NUMBER — OWNER SPEC (2026-11-27 20:09 + 20:19):** the member-number migration **0013 is pulled forward INTO this card** (out of T-08). **The number is a plain sequential integer starting at 1, displayed zero-padded to four digits (0001, 0002, 0003, …), unbounded** — owner-fixed format (amended by him 2026-11-27 20:22, superseding his 10001 start of 20:19): no prefix, no check digit invention; past 9999 the display widens naturally (10000). The barcode encodes the displayed (padded) form. Assigned at registration, backfilled for existing members in registration order, stable for life, never reused, never the internal UUID. Displayed on this card and the member page; **the card's barcode encodes this number**. T-08's admin customer view then reads the same number. No decorative QR. No invented tiers, perks, or expiry. Calm empty/loading state instead of any fake balance.
- **CARD CONTENTS — OWNER SPEC (2026-11-27 20:20, "بشكل انيق"):** the card shows, elegantly: **the member's name · the membership number · the membership date (member since, from the profile's real creation date) · the barcode (encoding the number)**. The design expresses the identity of AZAL and Yemen — through the official brand package only (palette, wordmark, the brand's own Yemeni geometry), per the identity law above.
- **RE-SEQUENCED BY THE OWNER (2026-11-27 20:19):** this card runs NOW, ahead of T-04, on Claude's remaining weekly capacity (~5%), in this strict build order — (1) migration 0013 (the number system), (2) **the signed-in customer account is REDESIGNED around the membership** (owner directive 2026-11-27 20:23 — this step absorbs T-04 in full): calm, separate sections in his established taste, mobile-first, EN/FR/AR — the membership card at the top (name · number · member-since date · barcode · points balance shown ONCE, with the plain-words economics incl. the founding benefit), then my details (edit name/phone), then my orders, then sign out. **The join pitch is GONE for signed-in members** (F-OWN-17; visitors keep it), (3) any card refinement the redesign leaves. Each step committed separately, so whatever lands is complete; anything unfinished resumes at Sunday's reset.
- **Sequence:** after T-04 (which reworks the same member-page surface — building the card first would build it twice); before the rest of T-08. Never ahead of T-22.
- **Acceptance:** lead live-check signed-in in EN/FR/AR (RTL), points match the ledger, empty state honest, 320/390/desktop widths; pinning tests per BUILD-METHOD.

### T-24 · Order timeline times + numbers-only order identity — F-OWN-22 / F-OWN-23 (owner, 2026-11-27 20:17, from his tracking-page photo)
- **Stage times:** on the customer order-status view, every COMPLETED stage (Received · Accepted by the kitchen · Ready for pickup · Collected) shows the actual time it happened, from the order's recorded status history — real recorded times only, never estimates (the page already promises "what the kitchen has confirmed, not an estimate"). A stage not yet reached shows no time and renders as pending — acceptance includes checking that an unreached stage never appears completed.
- **Numbers only:** the sigil word+icon presentation (🌹 Rose 11, 🍇 Grape 30, …) is REMOVED everywhere — checkout confirmation, order detail/tracking, member history, and the staff screen. The 6-character order code stands alone as the spoken/shown identifier ("just say code 08980A"). The staff screen's collision flag keys on the code itself. This owner directive supersedes the V8 presentation vote; the code derivation is unchanged.
- **How:** Claude, in the same batch as T-04 (T-24 first — it is small), branch `claude/order-timeline-numbers`. EN/FR/AR strings for the stage-time lines; pinning tests: a handed-over order shows four times, a ready order shows three and no Collected time; no sigil word renders in any view.
- **Acceptance:** lead live-check on a real staging order at each stage + the code-only confirmation on a fresh guest order.


## 2026-11-28 — Muse adjudication A1–A6 (binding additions to the admin phase)

Muse approved `ADMIN-DESIGN.md` with A1–A6 at 00:10 EST (commit `f79e04cc8b0f9249af1657e751b212dc652650df`). These additions control over earlier unadjudicated placeholders; historical notes are not rewritten.

- **T-14 now includes A1 + A2.** A1: customer directory search (name/email/phone/member number) and pagination are server-side; bounded pages; 1,000-customer usability test. A2: Admin-only customer anonymize/deactivate with mandatory reason and audit; scrub profile/auth/order contact PII; disable sign-in; retire member number; exclude from directory; preserve immutable points ledger, order IDs, item snapshots, tax and financial aggregates. No hard delete or ledger/tax rewrite.
- **T-26 (after T-14):** Today's summary on `staff.html`, collected-sales total plus status counts; employee manually shares it; no email/send/outbox machinery and no tax line.
- **T-25 (after T-14):** paid_at-based Toronto calendar periods. Admin sees all branches and subtotal/HST/discount breakdown; Manager sees assigned-branch order/status counts and collected total only.
- **A5 build sequence:** T-14 (A1/A2) → T-25 + T-26 → T-21 → T-13 → T-20. T-08 accepted by Muse at 2026-11-27 23:52.
- **A6:** no email notifications or new email-sending path; T-06 staff Reject remains Copilot's separate flow and is not rebuilt by T-20.

**T-14 implementation boundary:** branch `chatgpt/t14-team-access`; no staging/production SQL apply, user invites, Orders account creation/password reset, customer anonymization, email sending or deployment by ChatGPT.


### A5 migration ordering clarification — lead ruling 2026-11-28
Because A5 moves T14 before T21 and T13, the old T13=0015 placeholder is superseded. T14 owns migration 0015. T25/T26, T21, T13 and T20 must receive new monotonically increasing migration versions in the approved A5 task order as their actual schema needs become known. Never apply a lower-numbered migration after 0015 has been applied.


## 2026-11-28 12:26 EST — Muse adjudication: T-25/T-26, T-27, T-28, T-29

This dated addendum is authoritative over earlier unadjudicated shell sketches; prior history remains unchanged.

### T-25 — Sales reports (Admin / Manager)
- One server-side reporting RPC, Toronto day/month/year buckets using immutable paid_at.
- ADM-1: only handed-over orders count as collected.
- Admin sees gross collected, refunds separately, net, status counts, and stored subtotal/discount/HST snapshots.
- Manager sees assigned-branch counts and net collected only; no gross/refund/tax/customer breakdown.
- Refunds after handover reduce net once; refunds before handover do not become collected refunds.
- One canonical migration 0017 only. Staging apply and live role walk are Muse/lead gates.

### T-26 — Staff Today's summary
- Staff-only, server-enforced own-branch Toronto-day status counts and net collected only.
- Lives in Kitchen History after T-28; employee may manually copy/share.
- No tax breakdown, email, SMTP, outbox, scheduled or automatic sending.

### T-27 — Admin shell (ChatGPT, assigned 2026-11-28 12:26)
- Five destinations: Home, Orders, Customers, Reports, More.
- Orders tabs: Active / Scheduled / History. Reports tabs: Daily / Monthly / Yearly.
- More: Team & access (Active/Pending), Orders accounts, Access history.
- Menu is absent until T-21. Identity/sign-out remain behind the header profile icon.
- One job per screen, max five destinations, unauthorized destinations absent, no empty containers, stable hash addresses, load data on entry, poll only Home.
- T-25 Reports UI mounts here; no reports UI on the old stacked page.

### T-28 — Kitchen shell (ChatGPT after T-27)
- Four screens: Queue, Scheduled, History, Availability.
- Queue chips: All / New / Preparing / Ready. Scheduled appears only when non-empty. T-26 summary lives at top of History.
- Availability is not rendered until T-29's authoritative state/RPC exists. No Settings destination.

### T-29 — Availability state + audited kitchen RPC (full review)
- Temporary Sold out today / In stock is Kitchen-only, own branch, audited actor/time/item/branch, auto-reset next business day.
- Manager/T-21 retains permanent unavailability, item retirement and canonical menu edits.
- Requires authoritative branch × item state, server-side branch enforcement and audit; never a client-only toggle.

**Sequence:** T-25/T-26 data gate → T-27 Admin shell → T-28 Kitchen shell → T-29 availability. Claude's Sunday queue remains T-24 → T-03 and is separate from ChatGPT's shell work.


## 2026-11-28 12:26 EST — Muse T-27 adjudication (binding)

### T-27 · Admin portal shell — F-OWN-32
- **Owner:** ChatGPT · **Sequence:** immediately after T-25/T-26 READY; before T-28.
- **Constitution:** one job per screen; at most five persistent destinations; unauthorized destinations are absent (never greyed); no empty containers; every screen has a URL hash; load each screen's data on entry; poll only Home/live operational surfaces.
- **Destinations:** Home · Orders · Customers · Reports · More. Menu is absent until T-21 lands. Home is headline tiles + actionable Needs attention only; Orders has Active/Scheduled/History; Customers has server-paged directory and a customer detail view (Anonymize only inside detail); Reports mounts T-25 with Daily/Monthly/Yearly tabs; More contains Team & access (Active/Pending), Orders accounts, and Access history. Manager uses the same shell but only destinations/actions allowed by the server role matrix are rendered.
- **Responsive shell:** phone bottom bar; tablet/desktop left rail; profile/sign-out remains in the header; deep links and browser Back work; aria-current, focus management, and no empty placeholders.
- **Today panel:** detailed figures move to Reports; Home retains only concise headline operational facts.
- **Boundary:** presentation-only; preserve all T-08/T-14 RPC, permissions, audit and data behavior. No SQL, backend permission change, deployment or live mutation.
- **Acceptance:** Node + browser CI; EN/FR/AR at 320/390/768/1280; Admin/Manager destination matrix; navigation/deep-link/back/focus; no dead Menu or Availability links; T-25 UI consumes existing RPC and preserves role-redacted payloads.

### T-28 · Kitchen / Orders shell — F-OWN-32
- **Owner:** ChatGPT · **Sequence:** after T-27.
- **Screens:** Queue (start) · Scheduled (only if at least one scheduled order exists) · History (T-26 Today's summary at top). Availability is deliberately absent until T-29. Settings is absent; identity/sign-out remain behind the header profile icon.
- **Queue:** stage chips All · New · Preparing · Ready with live counts; tickets retain code-only identity and existing guarded action flow. Queue is the only polling screen (20-second cadence, hidden tab pauses).
- **History:** collected-sales total + status counts from azal_staff_today_summary; employee copy/share is manual only; no tax, email, outbox, auto-send, or fabricated history rows.
- **Boundary:** no backend/schema/role change; branch picker remains a view filter backed by server-authorized branch list.
- **Acceptance:** Node + browser CI; EN/FR/AR and 320/390/768/1280; stage filters/counts; scheduled visibility; summary redaction; Queue-only polling; keyboard/focus and deep links.

### T-29 · Kitchen same-day availability state + audited RPC — owner ruling 11:07, Muse renumbering 12:26
- **Owner:** assigned after T-27/T-28; full-review class.
- **Scope:** own-branch temporary Sold out today state, actor/time/item audit, next-business-day auto-reset; staff may only change own authorized branch. Manager/T-21 retains permanent availability, retirement and all canonical menu edits.
- **Boundary:** T-28 must not render Availability until T-29's authoritative state and server enforcement are delivered and gated. Migration/RPC/role matrix require full review and live acceptance.


## 2026-11-28 12:26 EST — T-27 delivery checkpoint
- PR #88 opened as a stacked draft PR; branch chatgpt/t27-admin-shell-v4; base chatgpt/t25-t26-reporting-shell-proposal.
- Exact head at PR creation: 977da6d12d2c029eb0eb136cf693b62fbc63060d. Own Node/browser CI remains pending; do not merge until every required job passes and the lead reviews the exact head.
- T-25/T-26 PR #85 is Ready for review (not merge), exact head 977da6d12d2c029eb0eb136cf693b62fbc63060d; all five CI jobs SUCCESS. No SQL applied and no deployment.
- Superseded PR #86 and #87 are closed; PR #84 was already closed as superseded.
- Old branch deletion remains outstanding: the connected GitHub actions expose branch search/create/update but no delete-ref operation. No deletion is claimed.
