# BUILD-METHOD.md — how the admin phase is built, in one pass

**Lead order to Claude (owner directive 2026-11-27 18:45):** understanding the requirement is not enough — the METHOD is fixed here, with the technical decisions pre-made and a detail checklist to clear before delivery, so each batch is built **once, complete**. If you find a gap in this method or in a card mid-build: stop, report the gap in CLAUDE-REPLY.md, and wait for the lead's answer inside the cycle — never improvise around it. This method governs the admin phase (T-08, T-14, T-21, T-13, T-20) and every batch from T-04 onward.

## 1. The basis (one place — do not reconstruct it from scattered sections)

- **Accounts — Uber's model, approved literally (ACCESS-PROPOSAL.md v2 + U1):** two separate logins. The **Manager account** (admin.html; the owner is Admin) and the **Orders account** (staff.html; one shared login per branch, its password set/reset by the Admin from the panel). Manager-side named users carry roles **Admin / Manager / Staff**; customers are separate accounts entirely.
- **The owner's admin powers (his list, 2026-11-27 18:30 + 18:43):** see all orders · customer directory (phones, emails, member numbers, balances) · membership accounts · add bonus points (audited) · cancel an order (reason, shown to the customer) · refund money · manage the menu like Uber (products, names, photos, prices, add products).
- **Role scope:** Admin = everything. Manager = operations for his branch (orders, reports, menu, inventory, inviting Staff) — never points, refunds, settings, or granting roles at/above his own. Staff / Orders account = the branch's paid queue only. Customer = his own account only. (Full matrix: ACCESS-PROPOSAL.md §2/§4.)

## 2. Build sequence inside the admin phase (fixed)

1. **T-08** — directory + all-status history + member number + membership card. (Everything else hangs off the admin shell and the directory.)
2. **T-14** — team & access: roles incl. Manager, the Team section, the branch Orders account. (T-21/T-13/T-20 all gate on these roles.)
3. **T-21** — menu manager (catalog becomes the live source of truth).
4. **T-13** — audited points adjustment (the audit pattern the rest reuse).
5. **T-20** — admin cancel + refund (reuses T-13's audit/idempotency pattern).

One batch at a time, in this order, per the adopted work system.

## 3. Technical decisions — already made, do not re-decide

- **Roles:** the existing `user_roles` + branch-access tables carry the model; add the `manager` role value; extend the existing server-side helpers (`azal_is_admin` pattern) — no new auth system, no client-side role trust. Every capability check is server-side.
- **Orders account:** a real Supabase Auth user per branch (username displayed in the Team section). Password set/reset by the Admin runs through a **Supabase Edge Function holding the service key server-side only** — the browser never sees it; the function verifies the caller is Admin and writes an audit row for every password action. (Internals are your design; these constraints are fixed.)
- **Menu catalog:** the database is the single source of truth. Public pages read the active catalog per branch from Supabase; photos live in a Storage bucket `menu-photos` (public read; write restricted to Admin + branch Manager); retiring an item is a status flag — **never a DELETE** (order history renders from snapshots).
- **Money/points actions:** all through SECURITY DEFINER RPCs with locked `search_path`, a server-side role check, a required reason where the card says so, an idempotency key, and effects written as append-only ledger/audit entries (the ADM-3 pattern — reuse it, do not redesign it).
- **One audit table** for admin actions: actor, action, target, reason, timestamp. Every admin write lands there.
- **Copy:** every new string in EN/FR/AR in the same commit; Arabic written from the meaning. No string ships in one language only.

## 4. The detail checklist — cleared and stated BEFORE you post READY FOR LEAD GATE

For the batch's card, line by line in your delivery section:

1. Every control on every touched surface is wired and does its real job — including in the no-access, signed-out, empty, loading, and error states.
2. Sign-out present and working on every authenticated surface you touched (T-01 standard), and no async answer can repaint data after sign-out or account switch (the #67 generation-guard pattern).
3. EN/FR/AR complete: a script diff of translation keys touched vs main shows no missing key in any language; no sync dropped a script tag (page-by-page check, per your own sync discipline).
4. Layouts checked at 320 / 390 / 1280 px in EN/FR/AR; no horizontal scroll; no sticky element covering a control (the standing defect ledger classes, checked one by one and stated).
5. Tests: one pinning test per behaviour in the card, plus the **role × forbidden-action matrix** for anything role-gated (each role attempts each forbidden action; the server refuses). Suite output lines + CI run id attached.
6. An explicit **NOT verified** line — and it may not contain anything the checklist above could have verified.

A delivery that reaches the gate with a checklist item unexamined is returned unreviewed. Review verifies; it is not where basics get discovered.

## 5. The one-pass rule

Build the whole card, clear §4, post once. The lead then reviews at the exact head, merges, and live-walks the acceptance the same day. Fixes after the gate mean the checklist failed — the delivery section says which line, so the miss is learned from, not repeated.

*BUILD-METHOD v1 — Muse (team lead), 2026-11-27. Changes only by a lead note in MUSE-REPLY.md naming the change.*
