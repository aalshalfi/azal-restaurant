# ADMIN-DESIGN — AZAL Management Portal
**Status:** DESIGN ONLY · submitted for Muse (lead) arbitration · no implementation authorized  
**Prepared:** 2026-11-27 (Toronto)  
**Scope:** T-14 Team & Access, T-21 Menu Manager, T-13 Points Adjustment, T-20 Cancel & Refund, with T-25/T-26 reports embedded as collapsed sections.

> This document is a product/UI and workflow specification. It does not authorize code, migrations, SQL execution, storage changes, invites, password changes, refunds, points adjustments, feature activation, or deployment. Build work remains stopped until the lead records an explicit verdict and opens the relevant task in the fixed sequence.

## 1. Design invariants — fixed, not reopened here

1. **T-08 remains the foundation.** Reuse its protected admin shell, customer directory, customer/order detail, all-status order history, member number/card and existing search. Do not redesign or duplicate shipped T-08 surfaces.
2. **Access model is fixed (Uber U1 + owner rule).** Two distinct authentication doors: Manager portal at `admin.html`, and one shared Orders identity per branch at `staff.html`. Named Manager-side users have roles Admin / Manager / Staff. Customers remain separate identities.
3. **Admin is the sole authority** for users/roles, points adjustments, cancellations/refunds, settings, payment/tax information and branch Orders credential reset. The owner/Admin account cannot be removed or demoted from inside the system.
4. **Manager is operational and branch-scoped:** menu, branch operations, inventory and reports. No users/roles, points, refunds, settings, or payment/tax data.
5. **Staff and branch Orders identity:** kitchen queue for that branch only. No menu, customer directory, points, refunds, payment/tax, settings, team or cross-branch access. Staff named logins and the shared branch Orders login both reach the kitchen surface; Orders actions are attributed to the branch account.
6. **Points are ledger-derived and append-only.** Balance is the sum of ledger entries. Never edit/delete historical entries or store a separately mutable balance. The existing redemption rule is unchanged: 10,000 points = $10; redemption only in 10,000-point steps (5,000 is invalid). This document does not change earning, redemption, founding-member bonus, or checkout behavior.
7. **Tax is not configurable in these screens.** Retain the existing branch-level HST model and server-side cents/tax calculations and order snapshots. No per-item tax classes, no new tax rates, no client-side tax arithmetic, and no tax/payment data visible to Managers or Staff.
8. **T-08 shipped behavior stays intact.** Reuse its directory/history/card, identity and six-character public order code. New actions attach to existing customer/order details; do not create parallel records or alter historical snapshots.
9. **All authorization is server-side.** UI visibility is presentation only. Every RPC, query, Storage write and Edge Function independently enforces role and branch scope. No service-role key or password hash in the browser.
10. **Locales and accessibility:** every new visible string in EN/FR/AR; Arabic meaning-first; keyboard-operable controls, focus management, visible errors, responsive at 320 / 390 / 1280 px.

## 2. Portal map and navigation

The manager portal keeps one persistent shell: AZAL mark, current branch selector (Admin only may switch across branches; Manager sees only assigned branch), page title, signed-in identity/role, in-portal status/error region, and sign-out. A6: this region is in-portal only; this design authorizes no email notifications or new email-sending path. Navigation is role-derived and never grants access by itself.

| Navigation area | Admin | Manager | Staff / Orders |
|---|---:|---:|---:|
| Overview | All branches | Assigned branch | No |
| Orders & history (T-08) | All branches, all statuses | Assigned branch operational orders only; no money controls | Live kitchen queue only |
| Customers (T-08) | Directory + full customer/order detail | No | No |
| Menu (T-21) | All branches | Assigned branch | No |
| Team & access (T-14) | Full | No | No |
| Loyalty / points adjustment (T-13) | Full | No | No |
| Cancel / refund (T-20) | Full | No | No |
| Reports (T-25/T-26) | All branches; financial details | Operational/non-financial reports for assigned branch; no tax/payment data | No |
| Settings / payment / tax | Full | No | No |
| Kitchen | May open for oversight | May open assigned branch | Assigned branch only |

**Staff is not a limited Manager account.** It is a kitchen role. The branch Orders credential is not a person and cannot enter the Manager portal.

## 3. Screen specifications

### 3.1 Overview (existing shell landing)
- Admin: cross-branch operational snapshot and links into orders, customers and reports. Financial/tax tiles are Admin-only.
- Manager: assigned-branch operational snapshot only.
- Staff/Orders: no overview route; direct to kitchen queue.
- Empty/loading/error states are explicit; zero is not shown as an error and failed data is never rendered as zero.

### 3.2 T-14 — Team & Access (Admin only)
**Team list:** name, email, role, assigned branch(es), invitation/account state, last known access state, row actions. Search and filter by role/branch/status. No password is ever displayed.

**Add user flow:** Add person → enter name + email → choose Admin/Manager/Staff → choose branch scope (Admin may grant cross-branch Admin; Manager cannot access this screen) → review exact grant → send verified invitation → pending state. The invitee sets their own password through the verified auth flow. If the email already has an account, attach the role to that same identity; never create a duplicate identity.

**Edit flow:** Admin opens user → change role/branch scope or resend invite → show before/after → confirm → server rechecks caller authority → audit event. A caller cannot grant a role at or above their own authority; Manager cannot grant any role because Team is Admin-only.

**Remove flow:** Admin selects Remove → impact summary → confirm → revoke access on the next server request/session validation → record actor, target, branch, timestamp and reason. Protect the owner/Admin root account from self-removal/demotion. Do not silently delete the auth identity or historical audit trail.

**Branch Orders credential panel:** one identity per branch, provisioned with the branch and retained through staff turnover. Admin sees the branch Orders username and can set/reset its password. Reset flow: choose branch → reset password → server-side Edge Function verifies current Admin → set new secret → return one-time success only (never read back current password) → audit actor/branch/time. Keep Manager and Orders usernames distinct. Staff actions through this credential are stamped as the branch Orders account.

**Critical states:** no team members; pending invite; invite expired/resend; email already registered; removed/revoked; branch unavailable; Edge Function failure; signed-out; unauthorized deep link. Never imply an invite or reset succeeded until server confirmation.

### 3.2.1 A1/A2 — T-08 customer directory and lifecycle (delivered inside T-14)

**A1 — directory interaction:** the existing T-08 directory remains in place, with a 50-row server-paged result, server-side search over name/email/phone/member number, total count, and Previous/Next controls. The database computes balances only for the returned page. The order-history list must not bulk-fetch the entire customer directory to enrich orders; customer email/contact is fetched only when Admin opens one order detail. Acceptance includes 1,000 synthetic customers, deep-page navigation, and each search field.

**A2 — remove customer:** each Admin customer record has an “Anonymize & deactivate” action. The Admin must enter a reason and review the impact before confirming. A server-only Edge Function verifies the Admin, replaces the Auth email with a reserved example.invalid address, clears Auth user metadata, and bans sign-in; a service-role-only database function then scrubs Auth identity metadata, profile name/phone, and order contact fields, suspends membership, retires the member number, excludes the profile from the directory, and writes an immutable audit event. The member-number value remains reserved and is never reused. No hard delete is permitted. Keep order IDs, item/option snapshots, tax and financial columns, and append-only points-ledger rows unchanged; the remaining profile UUID is a non-identifying reconciliation key, not a customer-facing identity. No customer email is sent.

### 3.3 T-21 — Menu Manager (Admin + assigned-branch Manager)
**Menu list:** categories and products with photo, localized names, category, base price, availability, and status. Manager sees only assigned branch. Admin can select any branch.

**Product editor:** EN/FR/AR name, description/story, region/origin, category, base price in integer cents, photo, modifier groups and active/retired state. Validate required localized fields, positive valid price, image type/size, category membership and modifier constraints before save.

**Modifier groups (launch scope):** reusable groups with localized title, options, option prices, required/optional flag, minimum and maximum selections; attach groups to items in explicit order. Reject impossible combinations (min > max, max beyond available options, invalid prices). Checkout/server revalidates the selected options against the current catalog; client values are never pricing authority.

**Photo replacement:** select/upload → validate type/size → upload to `menu-photos` with Admin or assigned-branch Manager write authorization → commit item reference only after successful upload → retain previous live image until commit succeeds. Failed upload leaves old photo intact. Public read only; no client service key. Never render a broken image URL.

**Availability:** branch-specific item availability, including “Sold out today” and unavailable/indefinite. One authoritative branch/item state drives public menu and server-side checkout recheck. Do not create item/menu hours; branch operating hours govern. No per-item tax class.

**Retire flow:** retire (soft status) → confirm → hide from new sale while preserving item/order snapshots for history. No hard delete. Existing orders must continue rendering the name, options, price and photo snapshot they were placed with.

**Publish behavior:** save to the catalog source of truth; public menu and checkout read the same active branch catalog and server price. Show saved/failed state and last successful update. No separate draft/approval workflow; the owner is the editor. If a product is incomplete or its image is not committed, it is not exposed as a sellable item.

### 3.4 T-13 — Loyalty / Points Adjustment (Admin only)
Entry point: T-08 customer directory row and customer detail → “Adjust points”. Show member number, name, current ledger-derived balance and recent ledger entries before opening the form.

**Adjustment form:** signed integer delta (credit or debit), mandatory reason category and human-readable reason, optional order/reference, idempotency key generated per submission. Preview resulting balance and block a debit that would create a negative balance unless an explicit later owner policy authorizes it. Require a final review of target member, delta and reason.

**Commit:** one server-side SECURITY DEFINER RPC with locked/empty search_path, schema-qualified references, explicit Admin check, validation and idempotency. Insert a dedicated adjustment ledger entry and corresponding admin audit event atomically. Never update an existing ledger row or a balance field. Duplicate request key returns the original outcome without a second adjustment.

**Member view:** the member's own history shows the adjustment as a distinct entry with reason category and timestamp; no admin-only internal notes or other members' information. Staff/Orders and Manager cannot read the points ledger or invoke the adjustment RPC.

**States:** insufficient balance, invalid/zero delta, missing reason, duplicate/retried request, stale displayed balance, timeout/unknown outcome (resolve by idempotency key before retry), unauthorized, and success with new ledger-derived balance.

### 3.5 T-20 — Order cancellation & refund (Admin only)
Entry point: T-08 all-status order history → order detail. Display public six-character order code, customer, branch, status timeline, item/option snapshots, subtotal/tax/total as stored by the order, payment state, and points ledger effects. Do not recalculate historical tax or mutate order snapshots.

**Cancel flow:** available only before hand-over. Admin chooses Cancel → mandatory reason → preview customer-visible wording and points consequences → confirm. Server validates current status and Admin role, records the state transition + actor/time/reason audit event. Reason is visible to the customer in their order detail/history. No row deletion. Staff's kitchen Reject remains separate, with its existing reason-required flow; it is not an Admin cancel shortcut.

**Refund flow:** any paid order may be fully refunded. If order has already been handed over, cancellation is unavailable; refund-only is offered as an explicitly confirmed goodwill action. Before Stripe is connected, the UI must plainly say “Test mode — no money moves”; the test action records the test refund and payment state/event only. Real-money refund execution remains gated on the owner's Stripe connection and lead-controlled release; never show a real refund success from a test-mode record.

**Points consequences — append-only and idempotent:** reverse the order's earned points with a linked earn-reversal entry; return points redeemed on that order with a linked redemption-reversal entry; void any pending guest claim tied to that order. Each effect occurs at most once, linked to the original order/ledger event. A retry must not double-reverse or double-credit. No negative edits or deletion of ledger history.

**Safety states:** unpaid order; already cancelled; already refunded; handed-over; partial/unknown payment provider response; duplicate click; timeout; order changed since preview; non-Admin caller. For ambiguous provider outcomes, reconcile by provider idempotency/reference before retry. Never claim refund completion until the payment provider confirms it. Staff and Manager never see or invoke cancel/refund controls.

## 4. Reports — collapsed inside the same portal

Reports are secondary navigation cards, initially collapsed under “Reports”. They do not create a separate application or change the primary workflow.

### T-25 — Sales & HST reports (Admin + assigned-branch Manager)

**Period basis:** use order paid_at and Toronto calendar boundaries. Daily, monthly and yearly periods are derived from paid transactions, not order-created timestamps. Admin can select all branches or one branch; Manager is fixed to assigned branch(es).

**Admin view:**
- Paid order count, subtotal, discount, HST collected and collected total; refunds are shown separately and deducted only in the clearly labelled net figure.
- Daily/monthly/yearly roll-ups and drill-through to T-08 order detail.
- HST and discount breakdowns are Admin-only. Use stored authoritative order tax/discount values; do not recalculate historical tax or introduce new rates.
- Unpaid/failed orders are excluded from collected sales; test-mode and refunded records are labelled and not counted as new collected revenue.

**Manager view:**
- Assigned-branch order count, status counts and collected total only.
- No subtotal, discount, HST, payment details, customer directory, or cross-branch totals.
- Every value is computed server-side from paid_at and the assigned branch; no raw financial table access.

### T-26 — Today's staff summary (collapsed report section; A3)

- A compact “Today” summary on staff.html: collected-sales total and order counts by fulfilment status for the signed-in branch.
- Employees may manually share/read the summary; no email, push, outbox, SMTP, scheduled notification or automatic sending.
- No HST/tax line and no payment credentials. The endpoint returns only the branch's operational summary and collected-sales total.
- Server derives the branch from the authenticated Staff/Orders identity; callers cannot supply another branch. Manager/Admin access does not expand the Staff endpoint.

## 5. Permission matrix — decisive summary

| Capability / data | Admin | Manager | Staff / Orders | Customer |
|---|---:|---:|---:|---:|
| View all branches | Yes | No | No | No |
| View assigned branch operations | Yes | Yes | Queue only | Own orders |
| Manage named users / roles | Yes | No | No | No |
| View/reset branch Orders credential | Yes | No | No | No |
| View customer directory / cross-customer history | Yes | No | No | No |
| Edit catalog / photos / modifiers | Yes | Assigned branch | No | No |
| Change item availability / retire item | Yes | Assigned branch | No | No |
| View own order history | Admin can inspect | No customer-wide access | Queue only | Own only |
| Adjust points / read full ledger | Yes | No | No | Own balance/history only |
| Cancel / refund / payment details | Yes | No | No | Request/support only; no admin action |
| Reports | All; financial + HST | Assigned-branch operational subset only | No | No |
| Settings / payment / tax configuration | Yes | No | No | No |
| Kitchen order processing | Oversight | Assigned branch | Assigned branch | No |

**Default deny:** any unlisted capability is denied. Branch scope is enforced in database/API policy, not by a client-side branch selector. A user with multiple assigned branches sees only those branches; only Admin can grant/change those assignments.

## 6. Cross-screen flows

1. **Team lifecycle:** Admin → Team → Add → verified invite → user sets own password → role/branch access active → audit trail. Edit/resend/remove all remain in the same detail view.
2. **Branch kitchen login:** Admin → Team → branch Orders account → reset → Edge Function → new password used on branch kitchen device → queue remains branch-scoped.
3. **Catalog lifecycle:** Menu → category → add/edit product → attach modifier groups → upload photo → commit → public catalog reflects saved state → checkout server revalidates item, modifiers, price and availability → soft-retire when discontinued.
4. **Points adjustment:** T-08 customer → Adjust points → preview → Admin RPC → append-only ledger + audit → member history/balance refresh.
5. **Cancel/refund:** T-08 order detail → eligibility check → cancel with reason OR full refund → provider/test result → linked points reversal entries → customer-visible status/history.
6. **Reports:** Reports accordion → T-25 or T-26 → scoped period/branch → summary → drill-through to T-08 orders. Reports never mutate operational data.

## 7. Shared interaction and data rules
- All list views need server-side search/filter/pagination or a clearly bounded, explicit cap; do not fetch unbounded customer/order/menu datasets and silently slice them client-side.
- Every mutation uses optimistic UI only if rollback is clear; otherwise wait for server confirmation. Disable duplicate submission while pending, but retain idempotency for network retries.
- Stale data is labelled/refreshed; account switch/sign-out invalidates outstanding requests so late responses cannot repaint privileged data.
- Audit entries are append-only and include actor, action, target, branch context, reason, timestamp and request/idempotency reference where applicable.
- Order and menu historical snapshots are immutable. Current catalog edits never rewrite old orders.
- No destructive action uses a generic “Delete”; use revoke, retire, cancel or refund with explicit eligibility and confirmation.
- Every screen defines loading, empty, error, forbidden, signed-out, success and stale/conflict states.
- No report exports, bulk user import, menu scheduling, item-level hours, per-item tax, photo approval workflow, partial refunds, or customer-initiated administrative actions are included.

## 8. Dependencies and build gates — lead ruling A5 (binding)

T-08 is accepted by Muse's 2026-11-27 23:52 gate. The approved sequence is: **T-14 (including A1 + A2) → T-25 + T-26 → T-21 → T-13 → T-20.** T-14 owns migration **0015**; later migrations must be numbered monotonically in this same task order when their schema needs are finalized. Reports wait for T-14 so role scoping is enforced server-side. T-21 depends on the T-14 role scope; T-13 reuses the T-08 directory and established audit pattern; T-20 reuses T-13 idempotency/audit conventions. A6: T-20 must not rebuild or alter Copilot's T-06 staff Reject flow; that card retains its own gate.

Before each subsequent card starts, the lead confirms its task-specific scope and migration number, then opens only the next task in the established sequence. This approval does not authorize parallel implementation of later cards.

After approval, each task still requires its own BOARD claim, branch/PR, exact-head tests and role × forbidden-action matrix, EN/FR/AR and responsive checks, then lead review/live acceptance. Approval of this design is not approval to apply SQL, invite users, reset credentials, issue points, refund real money, activate payments, or deploy.

## 9. Lead decision log — adjudicated
- **2026-11-28 00:10 EST — Muse: APPROVE WITH CHANGES (A1–A6)**, source commit `f79e04cc8b0f9249af1657e751b212dc652650df`.
- **A1:** T-08 directory receives server-side search by name/email/phone/member number and server-side pagination; the 1,000-customer usability test is binding; delivered inside T-14.
- **A2:** Admin-only customer removal means anonymize + deactivate; scrub Auth email/metadata/identities, profile name/phone and order contact fields; disable sign-in, retire member number, exclude from directory, require reason and write immutable audit; preserve order IDs, tax/financial snapshots and append-only points ledger without customer-facing identity.
- **A3:** T-26 is Today's summary on staff.html, total collected sales + status counts, manually shared by employee; no email/send/outbox and no tax line; not in Manager Reports accordion.
- **A4:** T-25 uses paid_at and Toronto dates; Manager sees assigned-branch counts + collected total only; Admin alone sees subtotal/HST/discount.
- **A5:** order is T-14 (A1/A2) → T-25 + T-26 → T-21 → T-13 → T-20; T-08 accepted.
- **A6:** in-portal status only, no new email sending; Copilot T-06 staff Reject remains separate and is not rebuilt by T-20.
- **Current state:** approved design being implemented on the single T-14 delivery branch. No staging/production SQL, invites, password reset, customer anonymization, or deployment is authorized in this build.
