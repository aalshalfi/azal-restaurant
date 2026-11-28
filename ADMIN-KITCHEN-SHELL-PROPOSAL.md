# ADMIN + KITCHEN SHELL PROPOSAL — F-OWN-32

**Author:** ChatGPT  
**Basis:** Muse's 2026-11-28 10:53 ruling and 10:59 kitchen addendum  
**Status:** Proposal for lead adjudication; no UI shell implementation before T-27.

## Design principle

Borrow the *information architecture* of Uber's Manager and Orders tablet, not its visual skin. AZAL keeps its own calm typography, brand palette and spacing. Each screen has one primary job; navigation is persistent; secondary administration is one tap deep. Existing authorization, RLS, branch scoping, audit and immutable financial snapshots remain unchanged.

## 1. Manager / Admin portal — `admin.html`

### Persistent navigation

- **Phone:** fixed bottom navigation with four destinations: **Home · Orders · Menu · More**. Use icon + short label, safe-area padding, and a visible active state. The shell remains usable at 320px.
- **Desktop/tablet:** compact persistent left rail with the same four destinations and text labels; content occupies the remaining workspace. Do not create a second information architecture for desktop.
- **Menu** is a real destination reserved for T-21; until T-21 is delivered, show a clear not-yet-available state only if the lead wants the tab exposed. Do not invent menu-editing controls in this batch.
- Do not add a Marketing destination yet: no approved AZAL marketing workflow exists. It can be added later without changing the shell pattern.

### Screen map

| Destination | Screen content | Explicitly excluded |
|---|---|---|
| **Home** | Today headline: collected sales, active orders by key state, active Majlis members; concise operational alerts/recommendations only when actionable. | Full order list, directory, team, audit, report tables. |
| **Orders** | Dedicated order workspace with **Active · Scheduled · History** tabs. Search/filter belongs inside this screen. History owns completed/cancelled records and order detail. | Customer directory and staff management. |
| **Menu** | T-21 Menu Manager when built: menu items and modifier groups, with its own sub-navigation (e.g. Items · Categories/Modifiers · Availability). | Team, reports, order history. |
| **More** | Plain list of named destinations: **Reports**, **Customers**, **Team & access**, **Invitations**, **Orders accounts**, **Audit log**. Each opens a focused page, not an accordion appended to Home. | Dashboard metrics or mixed operational cards. |

### T-25 placement and Today-panel fate

- **T-25 Reports** lives at **More → Reports**, a dedicated screen with Daily / Monthly / Yearly period tabs (and date/branch filters appropriate to role). Admin can compare all branches or one branch and sees collected sales, subtotal, discount and HST breakdown. Manager sees only their server-authorized assigned branch, order/status counts and collected total; no subtotal, discount or HST.
- The current Today panel is **split, not duplicated**: Home keeps only a compact headline snapshot and actionable alerts; detailed period totals and financial breakdown move to Reports. Home must not become a second report screen.
- The branch selector is a view filter, never an authorization boundary. The server independently enforces Admin-all-branches vs Manager-assigned-branch scope.

## 2. Kitchen / Orders tablet — `staff.html`

### Persistent navigation

- **Tablet/desktop:** persistent left icon rail with **Queue · History · Scheduled · Availability · Settings**; icon + text tooltip/label, clear selected state.
- **Phone:** compact bottom navigation with the same destinations, preserving the same screen model.
- The initial landing screen is always **Queue**. A branch selector appears only for branches returned by the existing server-authorized staff-branch RPC.

### Screen map

| Destination | Screen content | Explicitly excluded |
|---|---|---|
| **Queue** | Live paid-order queue; stage chips **All · Needs attention · Preparing · Ready**, each with live count; one ticket per card with pickup time, order code, items, notes and permitted contact action. | History totals, availability catalogue, reports. |
| **History** | Completed/cancelled order history. At top, T-26 **Today's summary**: collected-sales total and status counts, with a copy/share-text action for the employee to send manually. No tax line and no automatic send, email, outbox or notification. | Customer directory, HST, subtotal/discount breakdown. |
| **Scheduled** | Future pickup orders in a dedicated chronological view; clear empty state when none exist. | Live queue stages. |
| **Availability** | Searchable branch item list, **Sold out today** filter with count, per-item **Sold out / In stock** control. | Editing item names, prices, photos, modifiers or permanent menu data. |
| **Settings** | Only operational settings already approved for the Orders identity (e.g. authorized branch context and sign-out); no credentials/password display. | Team roles, menu editing, customer data, financial settings. |

### Sold-out control placement — explicit recommendation

**Both surfaces, with deliberately different authority and semantics:**

1. **Kitchen → Availability:** staff may set/clear a *temporary “Sold out today”* flag for an item at their currently authorized branch. This is the fast operational control during service. It must be branch-scoped server-side, auditable, and must not change the canonical menu item or another branch's availability.
2. **Manager → Menu (T-21):** Manager owns the canonical menu and branch availability configuration (including planned/unavailable state); Admin retains oversight. The Manager sees the live kitchen “Sold out today” state but does not silently overwrite it when editing menu details.
3. The two controls must be separate data concepts and labels: temporary service flag vs Manager-controlled menu availability. Staff cannot edit names, prices, photos, modifiers or permanent availability. If the current schema cannot represent that distinction safely, ship the kitchen view read-only until a separately gated backend card exists; do not simulate a toggle in the UI.

This preserves the Orders identity's narrow role while giving the kitchen a useful service-time control. The exact persistence/audit contract is a separate lead-approved build slice, not part of T-25/T-26 aggregation.

## 3. T-25 / T-26 data contract

- **Collected convention:** retain ADM-1 semantics: an order contributes to collected sales only when payment is paid **and** fulfilment is `handed_over`. Do not equate placed/paid with collected.
- **Time bucketing:** use `paid_at` as the period timestamp, interpreted in `America/Toronto`, for daily/monthly/yearly buckets as Muse ruled. The qualifying collected order's amount and its immutable order snapshots are summed into the corresponding paid-time bucket.
- **Admin:** all branches; subtotal, discount, HST and collected total, plus order/status counts. Preserve integer cents through aggregation; format only at display.
- **Manager:** server derives assigned branch scope from identity; return only counts and collected total. Never return subtotal, discount, tax, raw customer/order PII, or allow a client-supplied branch list to widen scope.
- **T-26:** current Toronto day; collected total plus operational status counts; staff response excludes all tax/subtotal/discount fields. Employee manually copies/shares the summary; no automated dispatch.
- Prefer one server-side aggregate path with role-shaped outputs over loading all orders into browser memory. Tests must prove Admin/Manager/Staff separation, Toronto midnight/month/year boundaries (including DST), paid + handed-over inclusion, unpaid/cancelled/not-handed-over exclusion, and no financial breakdown in staff/Manager payloads.

## 4. Release boundaries

- This proposal changes no page markup, CSS, permissions, database or live state.
- T-25/T-26 aggregation may be implemented independently of the shell; no UI is placed into the old stacked page.
- T-27 owns the eventual presentation-only shell implementation after lead adjudication.
- No SQL application, merge, deployment, outbound send, or live mutation is authorized by this proposal.
