# Apply 0015 — T-14 Team & Access + A1/A2

**Operator:** Muse / authorized lead only. ChatGPT does not apply this migration.  
**Environment:** disposable PostgreSQL 16 for tests, then the designated AZAL staging project only after lead review. Never apply to production as part of this task.

## Sole-Admin identity (Muse 04:12 ruling; binding)

The owner identity is the only Admin identity: **info@azalrestaurant.com**. The database-level `azal_is_admin()` check requires both the `admin` role and this exact Auth email; the Team form cannot grant an Admin role, and the root Admin cannot be demoted or removed. The Supabase dashboard is the recovery path if the owner loses access: the owner + lead restore the existing owner identity/role there; **do not build a second Admin login or alternate back door**.

## Scope

- Adds the Manager role to the existing user_roles model and branch-scoped Manager authorization.
- Adds the branch-owned Orders identity registry and append-only Admin audit log.
- Adds in-portal pending team invitations. A6 is binding: **no invitation, notification, or password email is sent**. A pending team grant is attached only after the matching Auth account exists and its email is verified through the existing Auth flow.
- Adds server-side customer directory search/pagination (A1), with balances aggregated only for the returned page.
- Adds Admin-only customer anonymization/deactivation data operation (A2). The Edge Function scrubs the Auth email and bans sign-in; the RPC scrubs profile and order contact PII, suspends membership and retires the member number. Order IDs, item snapshots, tax/financial columns and append-only points ledger remain. No hard delete, ledger edit, or tax rewrite.
- Adds a narrow Manager orders RPC that returns only assigned-branch operational data; it omits customer contact, payment status, totals, subtotal, discounts and tax.
- Adds a server-derived branch list for the kitchen screen so each shared Orders account sees only its branch; named Staff with multiple assignments can choose only among those assignments.

## Preconditions

Confirm this is the intended staging project and the following are present:

    select current_database();
    select to_regprocedure('public.azal_is_admin()') as admin_guard;
    select to_regprocedure('public.azal_admin_customer_directory()') as t08_directory;
    select to_regclass('public.user_roles') as user_roles,
           to_regclass('public.staff_branch_access') as branch_access,
           to_regclass('public.profiles') as profiles,
           to_regclass('public.memberships') as memberships,
           to_regclass('public.points_ledger') as points_ledger,
           to_regclass('public.orders') as orders,
           to_regclass('public.order_items') as order_items,
           to_regclass('public.branches') as branches,
           to_regclass('auth.users') as auth_users,
       to_regclass('auth.identities') as auth_identities;

Expected: every object exists. Confirm profiles.display_name, phone, member_number, anonymized_at; orders.contact_phone, guest_name, guest_email, placed_at, fulfilment_status; and order_items.item_name_en_snapshot / item_name_fr_snapshot exist. Stop if the schema differs.

The migration itself preflights T-08's directory RPC and the required tables. It is transaction-wrapped. Do not infer that a successful local PG16 test means staging is ready.

## Disposable PostgreSQL 16 behavior run

Build a fresh disposable database using the repository's documented schema chain through 0014, then apply 0015 to that disposable database. Run:

    DATABASE_URL="$DISPOSABLE_PG16_URL" bash tests/sql/run-one.sh tests/sql/admin-team-access-behaviour.sql

Expected coverage:
- Admin-only team list, grant, revoke, pending invitation and verified-email activation.
- Manager cannot read the Admin team directory or access another branch; the Manager operational payload contains no PII/payment/tax/financial columns.
- Orders account is branch-linked and cannot be removed through the ordinary named-team action.
- A1 search by name/email/phone/member number, bounded pages, deep offsets and a 1,000-customer fixture.
- A2 requires a reason, scrubs identifying profile/order contact data, disables directory visibility, retires the member number, suspends membership, and retains points ledger + order financial history.
- Direct authenticated writes to the audit log are denied.

Also run:

    node --test tests/admin-team.test.mjs tests/admin-directory.test.mjs tests/admin.test.mjs tests/staff.test.mjs
    node tests/admin.browser.mjs
    node tests/admin-directory.browser.mjs
    node tests/staff.browser.mjs

Record exact PASS/FAIL/ERROR counts and CI run ID at the exact final SHA.

## Edge Function deployment (lead-operated staging only)

Deploy admin-team-access to the staging project only after SQL review:

    supabase functions deploy admin-team-access

Confirm verify_jwt = true in supabase/config.toml. Set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY in the Edge Function secret store. The service-role key must never appear in browser config, source literals, logs, or GitHub Actions output.

The function supports Admin-checked team assignment/removal, branch Orders account provision/reset, and customer anonymization. It sends no email. Branch Orders password creation/reset requires 16+ characters; the password is not read back or stored in browser state after completion.

## Staging acceptance (Muse / lead)

1. As Admin, add an existing verified Manager and Staff identity, each assigned to a branch; confirm the Manager lands in admin.html, Staff lands in staff.html.
2. Create one branch Orders account and verify it can open only that branch's kitchen queue; reset its password and verify the old password no longer works. No email is sent.
3. Remove a named Staff user; confirm server-side access is denied on the next request. Confirm the owner/Admin root cannot be demoted or removed.
4. Exercise A1 with at least 1,000 synthetic staging customers; verify page size stays bounded and search matches all four fields.
5. Exercise A2 only with a disposable staging customer; verify Auth sign-in is banned, Auth email and identity metadata replaced/scrubbed, Auth sign-in banned, profile/order contact PII scrubbed, member number retired, directory exclusion, and ledger/order/tax aggregates retained.
6. Confirm Manager branch RPC exposes no customer PII, payment state, subtotal, discount or HST.
7. Walk EN/FR/AR at 320 / 390 / 1280 px, including signed-out, forbidden, loading, empty, error, stale, success and sign-out states.

## Release boundaries

- No production apply or deploy in this task.
- No real email sending, outbox, SMTP, sign-up activation, payment activation or booking activation.
- No points adjustment (T-13), refund/cancel (T-20), menu management (T-21), or reports (T-25/T-26) implementation in this branch.
- T-06 Reject remains untouched.
- Do not treat UI hiding as authorization; every function/RPC enforces Admin or branch role server-side.
