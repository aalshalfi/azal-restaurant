# AZAL Command Center — Admin Experience Design v1
**Owner:** ChatGPT · **For:** Muse (team lead) + Claude · **Owner direction:** 2026-11-28
**Status:** Design proposal / implementation kickoff. This document does not supersede the T-27 shell constitution or authorize production changes.

## 1. Product intent
Build an original AZAL management experience inspired by the clarity and operational usefulness of Uber Eats Manager, not a visual or functional copy. The manager should understand the restaurant's current state in seconds and reach the next useful action in one step.

AZAL is currently one restaurant, one operating location, customer pickup only, plus table reservations. Do not build multi-branch administration, courier/delivery dispatch, driver tracking, fleet workflows, or a second manager portal. Preserve the existing branch-aware authorization model in data/API; a one-location UI is not permission to weaken server-side scoping.

## 2. Non-negotiable foundations
- Preserve the adjudicated T-27 shell: five destinations only — Home, Orders, Customers, Reports, More.
- Preserve role-shaped navigation: unauthorized destinations/actions are absent, not disabled or greyed out.
- Keep stable hash routes, deep links, Back/Forward, focus management, and load-on-entry data behaviour.
- No empty panels, dead links, fabricated numbers, or decorative controls without actions.
- T-27 remains presentation-only; do not alter RPCs, RLS, role permissions, audit semantics, payment state, or database schema as part of this visual refinement.
- Do not expose Menu until T-21 is delivered. Do not expose kitchen Availability until T-29 is delivered.
- T-28 kitchen shell remains a distinct operational surface; share visual tokens and interaction language, not admin-only navigation or data.
- Keep payment, reservation, email and order activation gates unchanged.

## 3. Visual identity — AZAL, not Uber
Use the repository's existing brand kit and official logo assets:
- Espresso brown: #42220E
- Gold: #CD8E2D
- Clay: #914820
- Ivory: #F8F1E7
- Cream: #FFFAF3
- Muted text: #6B5848
- Typography: Source Sans 3 for UI/body and Source Serif 4 for display headings, per docs/typography-spec.md. Arabic must use the approved Arabic font treatment already present in the repository; do not invent a new font pairing.
- Gold is an accent, not small text on ivory (insufficient contrast); use clay for readable text accents.
- Reuse assets/azal-logo.svg and assets/azal-symbol.svg; never redraw the wordmark.
- Premium hospitality character: warm, calm, editorial, precise. Avoid generic SaaS blue, Uber green, excessive gradients, neon status colors, and over-dense tables.

## 4. Information architecture
Five persistent destinations remain:
1. **Home — نبض آزال**
2. **Orders — الطلبات**
3. **Customers — العملاء**
4. **Reports — التقارير**
5. **More — المزيد**

Reservations are a first-class workflow nested inside Orders (e.g. Orders subview/tab and stable route #orders/reservations), not a sixth persistent destination. Pickup and reservations remain distinct data models and separate workflows.

### 4.1 Home — Nabd AZAL / نبض آزال
The screen is a command centre, not a report dump.

**Top context strip**
- Local Toronto date and service-day context.
- Current operational state only when backed by an authoritative source.
- Language/account/profile controls remain in the approved header.

**Primary KPI row**
- Pickup orders today.
- Awaiting action / active preparation count.
- Ready for pickup count.
- Collected orders and collected sales (use the approved ADM-1 meaning: only handed_over counts as collected).
- Reservations today / upcoming guests.

Show comparison deltas only when both current and comparison periods are complete and comparable. Otherwise omit the delta. No sample numbers in production UI.

**Operational pulse**
A compact visual flow of Pickup: New → Preparing → Ready → Handed over. Each stage count is clickable and opens the corresponding Orders filter. Cancelled/unpaid orders must not be misrepresented as collected sales.

**Today's reservations**
A concise timeline/list ordered by reservation time: time, party size, customer display name according to role policy, confirmation/arrival state. Selecting a reservation opens its detail within Orders/Reservations.

**Needs attention**
Only actionable, sourced facts: overdue pickup, unreviewed/new order, reservation awaiting confirmation or imminent arrival, payment exception. Each alert deep-links to the exact record. Inventory alerts are excluded until a reliable inventory source and threshold rules exist.

**Recent activity**
A small recent-orders/reservations list. Do not duplicate full financial breakdowns that belong in Reports.

### 4.2 Orders — one operational destination, two distinct workspaces
Use sub-navigation within Orders:
- Pickup: Active / Scheduled / History, retaining the T-27 accepted tabs and actual supported states.
- Reservations: Today / Upcoming / History (only if data and existing reservation features support them).

Pickup detail includes order code, items/options, pickup time, customer contact only when role-authorized, payment state, totals, notes, state history and only valid next actions.
Reservation detail includes booking code, customer, party size, date/time, notes, confirmation state and arrival/no-show/cancel actions supported by the existing reservation model.

Never merge a reservation into the order table, never count reservations as orders or sales, and never imply a reservation is paid.

### 4.3 Customers
Keep T-27 server-side search and pagination. Customer detail may show permitted order/reservation history and loyalty summary when connected. Sensitive personal data remains role-scoped. Anonymize/remove action remains only inside the detail view and follows the approved reason + audit + anonymize/deactivate flow; no hard deletion of financial history.

### 4.4 Reports
Keep the existing T-25 RPC and its role-shaped payloads. Admin may see the approved full financial breakdown. Manager sees only permitted counts/net and assigned scope. Use Daily / Monthly / Yearly tabs and the canonical Toronto periods. Do not recreate reporting calculations in browser code.

### 4.5 More
Team & access, Orders accounts, Access history. No speculative settings page. User identity and sign-out remain in the approved header.

## 5. Interaction model
- Every KPI, alert, stage and list row that looks interactive must navigate or act.
- Keep primary actions obvious and limited; secondary detail belongs in the record view.
- Use clear, consistent statuses with text + icon, not color alone.
- Use optimistic UI only where the existing server contract supports safe rollback; otherwise wait for server confirmation.
- Provide empty, loading, error, and permission-denied states that explain the next step without showing fake data.
- Keep focus visible, keyboard navigation predictable, and touch targets at least 44px.

## 6. Responsive behaviour
- Desktop: calm wide workspace, persistent navigation rail, dashboard grid with clear hierarchy.
- Tablet: collapsible rail and two-column content; preserve readable tables or switch rows to cards.
- Phone: compact header and bottom navigation, stacked KPI cards, timeline cards, no horizontal page overflow.
- Acceptance viewports: 320, 390, 768, 1280px.
- Locales: EN / FR / AR. Correct LTR/RTL layout, number/currency formatting and long French labels. Never hardcode English-only date or currency assumptions.

## 7. Proposed Home layout
1. Greeting + service date + status context.
2. Four/five high-priority KPI cards.
3. Two-column section: Pickup operational pulse + Reservations timeline.
4. Needs attention list.
5. Recent activity.
6. Sales trend chart only if the queried period/data is available; detailed breakdown remains in Reports.

The hierarchy should adapt by viewport. Do not force every widget into the first screen on mobile.

## 8. Build plan and safe sequencing
**Phase A — Design reconciliation (this branch):** record owner intent, map each proposed element to existing T-27/T-28 APIs and routes, and identify missing data. Ask Muse to adjudicate only conflicts or scope changes.
**Phase B — Admin Home visual refinement:** one branch/PR, presentation-only, using existing T-27 DOM/API contracts. Add tests for sourced values, no fabricated values, deep links, role visibility and responsive layout.
**Phase C — Orders reservation subview:** only reuse the already-approved reservation model and current reservation feature gates. No booking activation, schema or email changes.
**Phase D — Kitchen visual alignment:** after T-28 is green and accepted, align shared AZAL tokens without merging the Admin and Kitchen workflows.
**Phase E — Live review:** Muse/lead verifies EN/FR/AR × 320/390/768/1280 and Admin/Manager role matrix on staging. Manager-shaped reports require an actual Manager staging identity before live verification can be claimed.

## 9. Acceptance checklist
- [ ] The result looks and feels unmistakably AZAL, using official logo, palette and typography.
- [ ] Uber is used only as an information-architecture/usability reference, not copied.
- [ ] Exactly five persistent admin destinations.
- [ ] Reservations are discoverable inside Orders but remain separate from Pickup orders.
- [ ] Pickup-only workflow; no courier/delivery/driver UI.
- [ ] Home contains operational summary and actionable attention, not a full financial report.
- [ ] Every metric comes from a documented existing source; absent data is omitted or clearly unavailable.
- [ ] T-25 reporting remains server-authoritative and role-redacted.
- [ ] Existing T-08/T-14 security and audit behaviour is unchanged.
- [ ] No dead controls, dead routes, fake numbers or empty placeholder cards.
- [ ] EN/FR/AR and all four target widths pass Node/browser CI.
- [ ] No SQL, deployment, payment, email or live feature activation is included.

## 10. Questions for Muse's adjudication
1. Approve this as a visual/UX refinement of merged T-27, not a sixth destination or replacement shell?
2. Confirm Reservations should be a nested Orders workspace/route, with pickup and reservation records strictly separate?
3. Confirm the current T-28 branch remains the immediate implementation priority and this Admin refinement starts after its exact-head CI and lead gate, or authorize a parallel design-only phase while T-28 is being stabilized?

**Recommended answer:** approve the design principles and nested Reservations route; keep T-28 code ownership untouched; allow design reconciliation now, then implement Admin refinements in a single follow-up branch after T-28's blockers are resolved.
