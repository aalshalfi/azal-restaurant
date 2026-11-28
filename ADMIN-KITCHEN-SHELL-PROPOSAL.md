# ADMIN + KITCHEN SHELL — LEAD-ADJUDICATED T-27 / T-28 SPEC

**Decision source:** MUSE-REPLY.md 2026-11-28 12:26 EST — T-27 adjudication. This file records the adopted design; it does not authorize shell code before the assigned card's claim and gates.

## 0. Shell constitution (binding)

1. One primary job per screen.
2. At most five persistent destinations.
3. A role sees only destinations it can use; unauthorized destinations are absent, never greyed.
4. No empty containers.
5. Every screen has a stable address (for example #orders, #orders/<code>, #customers, #more/team) so Back and deep links work.
6. A screen loads its own data on entry. Poll only live screens: Admin Home and Kitchen Queue.
7. A branch selector is a view filter only; server authorization remains authoritative.
8. Keep AZAL's official palette, typography, logo and calm spacing. Use Uber only as an information-architecture reference, never as copied skin.

## 1. T-27 — Admin shell (admin.html)

**Five destinations (Claude's adopted structure):**

1. **Home** — headline tiles and a concise “Needs attention” list built only from existing facts. No full lists or secondary admin forms.
2. **Orders** — **Active · Scheduled · History** tabs. Order details open as their own addressable view.
3. **Customers** — bounded server-side directory. A customer opens as a separate view; Admin-only anonymization is inside that view, never on the list.
4. **Reports** — T-25 **Daily · Monthly · Yearly** periods. Admin sees gross collected, separate refunds, net, and stored financial snapshots; Manager sees assigned-branch counts and net only.
5. **More** — named destinations: Team & access (Active/Pending sub-tabs), Orders accounts, Access history. No accordion of unrelated sections.

**Not in this shell:** Menu is absent until T-21 lands; no dead Menu link. Identity and Sign out remain behind the header profile icon (F-OWN-25). The previous Today panel is reduced to Home headline facts; detailed period figures live only in Reports.

**Role behavior:** Admin sees all approved destinations. Manager uses the same shell, but any destination/action absent from the permission matrix is not rendered. The shell does not create or widen permissions.

## 2. T-28 — Kitchen shell (staff.html)

Four screens, with **Queue** as the start:

1. **Queue** — stage chips **All · New · Preparing · Ready** with live counts and one order ticket per card.
2. **Scheduled** — appears only when at least one scheduled order exists, with its count.
3. **History** — completed/cancelled history; T-26 Today's summary at the top, with manual copy/share only and net collected + status counts.
4. **Availability** — not rendered until T-29's authoritative state and audited RPC land.

No Settings destination. Identity and Sign out remain behind the header profile icon. Staff never sees customers, reports, team or menu editing.

## 3. T-29 — Availability (separate full-review card)

Per the owner's 11:07 ruling and Muse's 11:50/12:26 adjudication:
- Temporary **Sold out today / In stock** is on Kitchen → Availability, own authorized branch only.
- Every change records actor, time, item and branch.
- Temporary sold-out state resets automatically at the next business day.
- Manager/T-21 retains permanent unavailability, item retirement and all canonical menu edits.
- The kitchen Availability screen and toggle do not render until the authoritative branch × item state, RLS/RPC and audit path exist. No dead or client-only control.

## 4. Acceptance for the shell cards

- Role × destination matrix: forbidden destinations absent from the DOM.
- Every address and deep link opens the correct single screen; Back returns correctly.
- No empty containers; focus moves to the screen heading and aria-current="page" is correct.
- Data loads on entry; polling exists only on Admin Home and Kitchen Queue.
- EN/FR/AR including RTL; widths 320 / 390 / 768 / 1280 with no overflow.
- Existing Admin/Staff behavior and permission tests remain green.
- T-27 ships Admin shell + T-25 Reports mount; T-28 then ships Kitchen shell + T-26 History mount. T-29 remains separate and follows the shell sequence.

## 5. Release boundaries

T-27 is presentation-only and must preserve shipped RPCs, RLS, branch scopes and audit rules. T-28 is likewise presentation-only until T-29 is separately approved. No SQL application, deployment, email/send path, live mutation, or activation of orders/payments/reservations is authorized by this spec.
