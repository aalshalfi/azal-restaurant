# ChatGPT proposal — Admin and Staff navigation shells (F-OWN-32 / T-27 input)

**Status:** proposal for Muse/lead adjudication only. This is not an implementation authorization. T-25/T-26 aggregation may continue; their UI stays parked until the lead selects a shell.

## Design principle

One screen, one job. Preserve every shipped T-08/T-14 permission, RPC, audit event and data contract. Change presentation only: no new backend, no migration, no role expansion. Use the Uber Manager and Orders tablet references for information architecture, not their visual language. AZAL keeps its restrained Yemeni hospitality identity, warm neutral surfaces, clear typography and calm density.

## 1. Admin / Manager shell

### Persistent navigation

- **Desktop:** a compact left rail with AZAL mark, current branch selector, four labelled destinations, and account/sign-out anchored at the bottom. Main content occupies the remaining width. The rail remains visible while a page scrolls.
- **Phone:** a fixed bottom navigation bar with Home, Orders, Menu and More, respecting the iOS safe area. A compact top bar holds the AZAL mark, current branch and account access. More opens a full-height named-page list.
- Keep the same four primary destinations on both sizes. Use text labels with icons; do not make icon-only navigation the only affordance.
- Branch selector: Admin may select all branches or one active branch; Manager can select only an assigned branch or all assigned branches. Server authorization remains authoritative.
- Navigation changes the visible screen, not an anchor jump down one endless document. Preserve deep links and browser back/forward through a stable view query or hash.

### Screen map

| Destination | Content | What must not appear here |
|---|---|---|
| **Home** | Headline KPI cards, a small Today performance card, and a short recommendations list driven only by verified operational signals | Full order tables, customer directory, team/invite lists, audit rows |
| **Orders** | Its own Active / Scheduled / History tabs; order detail opens as a focused view | Team, customer directory or menu editor |
| **Menu** | Menu Manager: categories, items, localized content, modifiers, price and branch availability | Orders queue or customer directory |
| **More** | Plain list of Customers, Team & access, Invitations, Orders accounts, Audit log, Reports, Settings; Marketing stays here until it has a real shipped workflow | Empty placeholder cards or dead links |

**Home / Today decision:** retire the current large Today section as a standalone block. Keep its useful signal as a compact KPI card on Home: today's collected sales under ADM-1, current order/status counts and the few high-value owner metrics already supported by server data. Recommendations are short actions such as “orders awaiting acceptance”; never invent stock, sales or member insights that have no authoritative source. “View orders” and “View reports” are links to their dedicated screens, not duplicated tables.

**Orders:** Active, Scheduled and History are peer tabs inside Orders. Each tab has one list purpose; opening an order presents its detail separately. Preserve the existing contact-blind order list and detail-only Admin contact lookup. No eager customer-contact fetch on screen boot.

**Menu:** use ADMIN-DESIGN §3.3 as the functional boundary. Admin has global access; Manager is restricted to assigned branches. Product editing, modifier management, price and branch availability remain Manager/Admin work.

**More:** one tap deep, plain named rows with a concise description and clear role visibility. Customers, Team & access, Invitations, Orders accounts and Audit retain their existing T-08/T-14 gates. Marketing is not promoted to a primary tab until it has a real workflow; this avoids a decorative dead destination.

### Where T-25 lives

**More → Reports**, opening a dedicated Reports screen (not a card appended to Home or Orders). It contains the date range and daily/monthly/yearly granularity. Admin receives all-branch or one-branch subtotal, discount, stored HST, gross collected, refunds and net collected. Manager receives assigned-branch paid/status counts and net collected only. The current branch and date range remain visible in the page heading. A compact Home shortcut may say “View reports” but must not duplicate report tables.

### Small pending-invite spacing defect

Remove the empty box above **REVOKE INVITATION**. The pending-invite row should be a single aligned unit: invitee + assigned branch/role + pending state + revoke action. The action belongs at the row end (or a compact overflow on narrow phones); do not reserve a blank column. When no invite is pending, render no empty card. Keep the revoke confirmation and audit behavior unchanged.

## 2. Staff / Orders-tablet shell

### Persistent navigation

- **Tablet/desktop:** a narrow left icon rail with explicit labels: Live queue, History, Scheduled (only when scheduled orders exist), and Settings. The main panel is the active screen.
- **Phone:** compact top header plus a bottom navigation control for Queue and History; Scheduled appears only when there is scheduled work. Avoid shrinking the order cards to fit multiple jobs on one screen.
- The queue is the landing screen after Staff/Orders sign-in. Keep the current branch selector for staff assigned to multiple branches.

### Screen map

| Screen | Content | Single job |
|---|---|---|
| **Live queue** | Stage chips with live counts: All, Needs attention, Preparing, Ready; pickup-time groups; focused order cards | Work active orders |
| **History** | Completed/closed orders, date filter and T-26 Today's summary at the top | Review the day's outcome |
| **Scheduled** | Future pickup orders, shown when scheduled work exists | Prepare for upcoming orders |
| **Settings** | Signed-in identity, assigned branch selector and sign-out | Account/shift controls only |

Queue stage chips filter the queue; they do not become a second navigation system. Each order card shows the pickup time, short code/sigil, guest/order essentials and the next permitted action. Existing Accept → Ready → Hand over server transitions remain unchanged. History is not mixed into the active queue.

### Where T-26 lives

**Staff → History → Today's summary**, per the A3 ruling. The summary shows today's net collected sales and order counts by status for the authenticated Staff branch, using Toronto's day boundary. It has a manual copy/share affordance only. It never shows a tax/HST line, subtotal/discount breakdown, payment credentials, customer contact or other branches. No email, push, outbox, SMTP, scheduled or automatic sending path.

## 3. Sold-out / item availability decision

**Recommendation: Manager surface only (Menu → branch availability), not Staff/Orders and not both.**

Reasoning:
1. ADMIN-DESIGN §3.3 already defines one authoritative branch/item availability state that drives the public menu and server-side checkout recheck.
2. The Staff/Orders identity is an operational role; it must not gain catalog write access. A second kitchen-side toggle would create dual authority, race conditions and an unclear audit actor.
3. Admin and assigned-branch Manager can mark “Sold out today” or unavailable/indefinite from the Menu screen. The saved state is reflected on the kitchen view as read-only context where useful.
4. Staff can alert the Manager through existing human channels. A future “request sold out” workflow would require its own product decision and audit path; it is not part of this shell proposal.

## 4. Role visibility and invariants

- **Admin:** Home, Orders, Menu, all More destinations and all-branch reports.
- **Manager:** Home, Orders, Menu, Reports and only those More destinations already authorized; all data and mutations remain assigned-branch scoped.
- **Staff/Orders:** the separate Staff shell only; no Admin/Manager menu editor, team, customer, points or financial breakdown.
- Customer and anonymous sessions never see either management shell.
- Preserve all T-08/T-14 server-side checks, RLS, audit history, customer anonymization and contact lookup rules. Hiding a tab is not authorization.
- Keep EN/FR/AR localization, RTL layout, keyboard focus, visible active states, accessible names and no page-level horizontal scroll at 320px.

## 5. Acceptance gates for T-27

1. One active screen at a time; no endless stack of Today, directory, orders, team, invites and audit.
2. Phone and desktop navigation remain persistent and show the same destination model.
3. Home contains only headline stats/recommendations; Orders, Menu and More each have their own screens.
4. T-25 is More → Reports; T-26 is Staff → History → Today's summary.
5. Sold-out toggle is Manager/Admin-only; Staff receives read-only context at most.
6. The pending-invite blank box is removed without changing revoke confirmation/audit behavior.
7. Existing Admin/Manager/Staff/customer role matrix and all T-08/T-14 tests remain green.
8. Browser checks cover phone, tablet and desktop in EN/FR/AR, including RTL and branch switching.

**Lead decision requested:** adjudicate this proposal against Claude's proposal, then issue T-27 shell spec. Until then, this document is design input only and no shell UI is mounted.
