# UBER-REFERENCE.md — official merchant workflow reference

**Prepared by:** ChatGPT, at Muse's lead order (2026-11-27 19:09 EST)  
**Purpose:** Give the AZAL builders an evidence-based reference for the owner's approved literal Uber Eats U1 model. This is a public-document study, not access to a live Uber merchant account. Pages checked: 2026-11-27.

## Executive findings — corrections required before admin build

1. **Two separate doors are real.** Uber distinguishes the web Manager portal (business administration) from the Orders app (live order handling). The Orders username is shown in Manager's Users area and its password can be reset there. This supports U1: one branch/store Orders credential controlled from the Manager side. The two credentials are not necessarily the same; Uber explicitly warns that if they happen to be the same, resetting the Manager password also resets Orders.
2. **Role permissions in ACCESS-PROPOSAL v2 are too broad for Manager.** Uber's official role page says Admin has full access and can add Managers and Staff. Manager has broad operational access, but payment/tax information, inviting Managers/Staff, and account settings are restricted to Admin. Staff can edit menus/photos and view analytics, but cannot access Payments, Tax, Users, Settings, or Marketing. AZAL's current proposal says Manager can invite Staff and excludes menu management from Staff/Orders. Those are deliberate local deviations, not literal Uber behaviour; lead must decide whether to correct the cards or explicitly record the exception.
3. **The Orders app has more than a three-button kitchen queue.** Official guide describes New Order → In Progress → Ready for Pickup → Order History, with explicit confirmation at acceptance and ready stages, order timeout if a new order is not confirmed, item availability controls, pause/resume, and history. AZAL is pickup-only, so courier dispatch, delivery partner tracking, and "Ready for Pickup" courier semantics must NOT be copied literally. Preserve the customer-pickup meaning.
4. **Menu is structured, not just a product CRUD form.** Uber's Menu Maker includes menus with days/hours, categories attached to one or more menus, items with name/description/category/price/tax/product type, customizations/modifier groups with options/prices/rules, dietary details, item-level hours, availability, and photo review. Photos may be pending approval and are not necessarily live immediately. AZAL's T-21 card is currently a smaller catalogue scope; its missing structured-menu details are listed below.
5. **Uber has explicit role verification levels.** Admin = high verification; Manager = medium; Staff = low. This affects who may authorize sensitive account changes and obtain support. AZAL should not grant a Manager the ability to perform Admin-only operations merely because they are operationally senior.

## 1. The two products / credentials

| Uber product | Official documented purpose | U1 implication for AZAL |
|---|---|---|
| Uber Eats Manager (restaurant.uber.com / Manager portal) | Store administration: users, menu, store settings, analytics, payments/tax (role-gated) | Admin/Manager web portal in `admin.html` |
| Uber Eats Orders | Receive and manage live orders from the store; separate username/password | One Orders account per branch, used by the kitchen surface; not the owner's Manager login |

**Orders credential lifecycle (official help):**
- Manager → Users shows the Uber Eats Orders username.
- Manager → Users → Reset password lets an authorized Manager-side user set a new Orders password; Uber's documented policy requires at least 8 characters, one number, and one non-digit character on the cited help page.
- Staff can be added to Manager using their email associated with an Uber account. If the email is not already an Uber account, Uber emails a path to create a password.
- Uber cautions: if the Orders username is identical to the Manager username, resetting the Manager password also resets the Orders password. AZAL should keep the two identities distinct.
- The owner's U1 decision fixes the AZAL Orders account to the **branch**, not an employee. Staff turnover must not recreate or reassign the branch Orders identity.

**AZAL security translation:** a real branch-scoped auth identity is appropriate; display its username only to authorized Admin users. Password set/reset must go through a server-side function that authenticates the caller's Admin role, never expose a service key or password hash to the browser, and write an immutable audit event. Never display the current password; only allow reset. These are AZAL security requirements, not claims that Uber uses Supabase or the same implementation.

## 2. Official Manager roles and permission matrix

| Capability | Admin | Manager | Staff |
|---|---:|---:|---:|
| Full Manager portal access | Yes | Broad operational access | Key features / most pages |
| Add / remove / manage Manager and Staff users | Yes | No (Admin-only) | No |
| Edit menu and add photos | Yes | Yes | Yes |
| View analytics / sales / operational data | Yes | Yes | Yes |
| Payments and tax information | Yes | No | No |
| Account settings | Yes | No | No |
| Marketing | Yes | Not explicitly included in Manager's allowed scope in the cited role summary | No |
| Orders app | Separate Orders credential | Separate Orders credential | Separate Orders credential |

**Important wording:** Uber's role page says Managers have access to every feature and all pages, then expressly lists payment/tax, inviting Managers/Staff, and account settings as restricted to Admin. Read the explicit restrictions as controlling. Do not implement the broad phrase as unrestricted access.

**Verification/support levels (official Uber verification page):**
- Admin = High Verification: may approve new users/role changes and sensitive account changes; can access sensitive account information.
- Manager = Medium Verification: may request information and make operational (non-financial) changes.
- Staff = Low Verification: support for live-order issues and non-account troubleshooting.
- This is a support/authorization tier, not a replacement for server-side authorization on each API/RPC.

## 3. Manager — Menu Maker workflow

### Menu and category structure
- Create a menu with a name and days/times when it is available.
- Create categories and attach each category to one or more menus.
- An item will not appear to customers until it belongs to a category.
- Deleting a category does not delete its items.
- Menu hours can vary by day; individual items can also have custom hours.

### Item fields and editing
Official help documents adding an item with name, category, price, tax rate, and other details; another current Menu Maker article calls out a detailed description and photo. Editing includes name, description, customizations, additional size options, product type, dietary attributes, and other product-type-dependent fields. Some changes may require menu-team verification and may take up to 24 hours in the documented workflow.

### Modifiers / customizations
- Modifier groups are separate reusable structures.
- Each group has options, option prices, and group rules.
- Groups can be attached while editing an item.
- Example in Uber's help: choice of sauce; paid or free add-ons.
- For AZAL, the corresponding acceptance must include required/optional group rules, min/max selection, option price, and server-side validation. T-21 currently does not enumerate these; do not silently invent a reduced modifier model if real menu options depend on it.

### Photos
- Menu item photo is uploaded from the item editor (Photo tab/section).
- Uber may require approval; the merchant sees Pending / Approved / Rejected and can withdraw a pending change.
- Approved photos may be resized, reoriented, or have lighting/color adjusted.
- Replacing/removing an item photo is a separate action.
- Cover/store images use a separate workflow and approval state.
- **AZAL implication:** store photo status separately (pending/approved/rejected if approval is part of AZAL's own process); at minimum validate file type/size, retain old image until replacement is committed, and never leave an item with a broken image URL. Uber's approval workflow itself is not automatically required for AZAL.

### Availability and hours
- Item can be marked Sold out for Today or Indefinitely; the menu shows a visible red unavailable indicator.
- Orders app also has Item availability controls; if an item appears in multiple menu placements, the merchant may need to change each placement.
- Menu hours and custom item hours can vary by day.
- Menu can be Live or Paused.
- **AZAL implication:** one branch/item availability record must drive public menu rendering and the server-side checkout re-check. A client-only sold-out badge is insufficient.

### Deletion
Uber documents deleting an item from all menus. **AZAL's T-21 intentionally diverges:** use soft retirement only, because historical AZAL orders must continue rendering their item snapshots. This is a deliberate safer local rule.

## 4. Orders — live service workflow

Official Uber Orders guide describes:
1. **New Order:** alert appears; staff opens it and confirms. If not confirmed before timeout, the order automatically times out/cancels.
2. **In Progress:** accepted order moves here. Staff confirms when preparation is complete. While in progress, the app supports item-out-of-stock handling, contacting the customer, and other store-specific actions.
3. **Ready for Pickup:** a distinct terminal/near-terminal queue. Uber's own description often means a courier is being requested or is on the way; it is not equivalent to a customer walking to AZAL's counter.
4. **Order History:** historical orders can be opened by date; details, totals, and statuses such as cancelled/completed are shown.
5. **Pause/resume:** store can pause new orders for a period; Uber may also automatically pause a store after inactivity or repeated missed orders.

**AZAL mapping (do not copy delivery semantics):**
- New → paid order awaiting kitchen action.
- In Progress → accepted / preparing.
- Ready → prepared and waiting for the customer to collect.
- Handed over → collected by customer (AZAL's own explicit completion).
- Cancel/reject: AZAL's policy and payment/refund rules govern. Do not assume Uber's courier cancellation or settlement rules apply.
- History must remain accessible to Admin and appropriately scoped staff; completed/cancelled records must not disappear.
- A pause-new-orders control may be useful later, but must be a server-side branch-level setting and never silently alter payments or existing orders.

## 5. Material divergences between Uber and current AZAL proposal/cards

| Topic | Uber's documented behaviour | Current AZAL proposal/card | Required action |
|---|---|---|---|
| Manager can invite Staff | Admin only can add/manage Managers and Staff | ACCESS-PROPOSAL §2 says Manager invites Staff | **Correct T-14 / proposal** or record explicit owner-approved exception; not literal Uber |
| Staff menu edits | Staff can edit menu and add photos | AZAL Staff / Orders account is paid queue only | Keep as an intentional stricter separation only if owner confirms it; it is not Uber-literal |
| Manager payments/tax | Admin-only | ACCESS-PROPOSAL wording says Manager has broad access, but BUILD-METHOD excludes points/refunds/settings | Clarify: Manager cannot see payments/tax or sensitive settings under Uber's role model |
| Orders account password | Manager-side Users workflow; separate credential; reset action | BUILD-METHOD proposes Edge Function, service key server-side | Correct implementation direction; never expose current password |
| Orders queue | New → In Progress → Ready for Pickup → History; timeout and pause states | AZAL paid queue Accept → Ready → Hand over; Reject is a separate AZAL requirement | Add missing timeout/pause only if the owner wants it; preserve AZAL pickup and payment invariants |
| Menu structure | Menus, category membership, hours, modifiers, item-level hours, photos/approval | T-21 lists products, category, price, photo, per-branch availability | T-21 card needs explicit decision for modifiers, item/menu hours, tax/product type, and image replacement states before build |
| Delete item | Uber can delete from all menus | AZAL soft-retire only | Keep AZAL soft-retire; history preservation is intentional |
| Store identity | Uber Manager and Orders are separate products and credentials | AZAL admin.html and staff.html | Match the separation; branch Orders account is the branch identity per owner |

## 6. Exact questions for the lead / card corrections

1. Amend T-14 so **only Admin** can invite/remove/change Manager and Staff roles; Manager can operate the branch but cannot grant roles, access payments/tax, or change account settings.
2. Decide whether AZAL Staff should remain kitchen-only (stricter than Uber) or receive menu editing rights. The owner has approved the Uber model literally, so any stricter local exception should be explicit in the card.
3. Expand T-21 before assignment to cover modifier groups/options/rules, menu hours and item-level hours, tax/product type, and photo replacement/approval states—or explicitly mark each as out of launch scope.
4. Preserve the branch-level Orders credential, resettable only by Admin through a server-side audited function. Keep its login separate from Manager login.
5. Keep AZAL pickup-only semantics: "Ready" means ready for the customer, not courier dispatch. Keep customer hand-over as a distinct recorded action.

## 7. Official Uber sources (accessed 2026-11-27)

1. Managing access in Uber Eats Manager — Admin / Manager / Staff capabilities and add/edit/remove user flows:  
   https://help.uber.com/en-AU/merchants-and-restaurants/article/gerir-o-acesso-no-gestor-uber-eats?nodeId=931d0f36-f871-4c8a-be24-ca22ef9b45ff
2. Understanding the Admin role and Admin Requests — Admin's sensitive powers and ownership role:  
   https://help.uber.com/merchants-and-restaurants/article/razumevanje-vloge-skrbnika-in-zahtev-skrbnika?nodeId=3a2dbbd3-3cf1-448e-aa3b-d48a33ac9ac5
3. Verification Process — Admin/Manager/Staff verification levels and support authority:  
   https://help.uber.com/merchants-and-restaurants/article/proceso-de-verificaci%C3%B3n?nodeId=ee33426d-06db-4341-9e7f-c2107f0468bd
4. What if I forget my username and/or password? — separate Manager and Orders credentials; Users page; Orders password reset:  
   https://help.uber.com/en/merchants-and-restaurants/article/what-if-i-forget-my-username-andor-password?nodeId=c908178e-4d8c-4f4e-8998-8c07ff374447
5. How to add users to Uber Eats Manager — invite flow and existing/new Uber account behaviour:  
   https://help.uber.com/am/merchants-and-restaurants/article/how-to-add-users-to-uber-eats-manager?nodeId=300c7b20-f7ed-43d7-9202-05e6ba1a9b58
6. Creating your Uber Eats Menu — menus, menu hours, categories and category-to-menu assignment:  
   https://help.uber.com/merchants-and-restaurants/article/creating-your-uber-eats-menu?nodeId=53eccecf-f372-468d-9233-22d07b7019f4
7. Editing your Uber Eats Menu — item editor, categories, customizations, menu pause:  
   https://help.uber.com/merchants-and-restaurants/article/editing-your-uber-eats-menu-?nodeId=49fa4c19-7c4f-408f-97a3-42dbdc56ffbe
8. Adding cover images and menu photos — upload, approval, rejection, replace/remove:  
   https://help.uber.com/merchants-and-restaurants/article/adding-cover-images-and-menu-photos?nodeId=fb999784-7eee-402c-a5f1-89b9ef5921d2
9. How to update an item — price, Sold out Today/Indefinitely, Orders app availability:  
   https://help.uber.com/merchants-and-restaurants/article/how-to-update-an-item?nodeId=3a91c2cd-d85e-4f67-b816-1437ff0d5bfc
10. Uber Eats Orders User Guide — New Order, In Progress, Ready for Pickup, Order History, pause and menu controls:  
    https://help.uber.com/en-GB/merchants-and-restaurants/article/uber-eats-orders-user-guide?nodeId=cf66954d-a1c7-4148-a011-3c2bee00a6ad
11. Why do orders pause automatically? — inactivity/missed-order pause behaviour:  
    https://help.uber.com/so/merchants-and-restaurants/article/why-do-orders-pause-automatically?nodeId=29d5f77c-dd8b-450a-ba6f-39c5500b19ef

**Scope limitation:** public official help pages only. No private Uber merchant account, live tablet, internal support console, or production account was accessed. Some Uber help pages are localized variants; the documented workflow may vary by country, merchant setup, POS integration, or product version. The source pages explicitly warn that POS-integrated merchants should edit the POS rather than Menu Maker; AZAL is not assumed to have a POS integration.

— ChatGPT
