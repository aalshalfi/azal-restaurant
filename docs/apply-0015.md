# Apply 0015 — T-14 Team & Access + A1/A2

**Operator:** Muse / authorized lead only. ChatGPT does not apply this migration.  
**Environment:** disposable PostgreSQL 16 for tests, then the designated AZAL staging project only after lead review. Never apply to production as part of this task.

## Sole-Admin identity (Muse 04:12 ruling; binding)

The owner identity is the only Admin identity: **info@azalrestaurant.com**. The database-level `azal_is_admin()` check requires both the `admin` role and this exact Auth email; migration 0015 stops if the owner identity is missing or any non-owner Admin row remains. Reconcile legacy non-owner Admin roles with the lead before applying; do not silently promote or demote an account. The Team form cannot grant an Admin role, and the root Admin cannot be demoted or removed. The Supabase dashboard is the recovery path if the owner loses access: the owner + lead restore the existing owner identity/role there; **do not build a second Admin login or alternate back door**.

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
           to_regclass('public.points_claims') as points_claims,
           to_regclass('public.order_outbox') as order_outbox,
           to_regclass('public.orders') as orders,
           to_regclass('public.order_items') as order_items,
           to_regclass('public.branches') as branches,
           to_regclass('auth.users') as auth_users,
       to_regclass('auth.identities') as auth_identities;

Expected: every object exists. Confirm profiles.display_name, phone, member_number, anonymized_at; orders.contact_phone, guest_name, guest_email, placed_at, fulfilment_status; and order_items.item_name_en_snapshot / item_name_fr_snapshot exist. Stop if the schema differs.

The migration itself preflights T-08's directory RPC and the required tables. It is transaction-wrapped. Do not infer that a successful local PG16 test means staging is ready.

## Mandatory backup, restore rehearsal and rollback plan (lead-operated)

**This is a hard precondition, not an optional checklist.** Do not apply 0015 or exercise A2 on staging until the lead has a verified pre-change backup and a successful restore rehearsal. Use only the designated staging project and synthetic customer identities; never anonymize a real customer as an acceptance test.

1. Record the staging project reference, database name, operator, UTC capture time and intended change window. Confirm the target is staging, not production.
2. Create a full logical backup with an authorized database connection. Keep credentials in the operator's secret environment; do not paste connection strings into notes or CI logs.

       export BACKUP_FILE="azal-staging-before-0015-$(date -u +%Y%m%dT%H%M%SZ).dump"
       pg_dump --format=custom --no-owner --no-acl "$STAGING_DATABASE_URL" --file="$BACKUP_FILE"
       sha256sum "$BACKUP_FILE" | tee "$BACKUP_FILE.sha256"
       pg_restore --list "$BACKUP_FILE" > "$BACKUP_FILE.toc"

3. Rehearse the restore into a **separate empty disposable recovery database/project**, never over staging or production:

       pg_restore --exit-on-error --no-owner --no-acl \
         --dbname="$RESTORE_TEST_DATABASE_URL" "$BACKUP_FILE"
       psql "$RESTORE_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
         -c "select current_database();" \
         -c "select count(*) from public.orders;" \
         -c "select count(*) from public.profiles;" \
         -c "select count(*) from public.points_claims;" \
         -c "select count(*) from public.order_outbox;" \
         -c "select count(*) from auth.users;" \
         -c "select count(*) from auth.identities;"

   Compare the restored database identity and row counts with the recorded staging baseline. The restore rehearsal must finish without errors; retain its command output and the dump checksum.

If permissions cannot capture and restore `auth.users` and `auth.identities`, stop and use a verified provider-level snapshot that includes the Auth schema; a partial public-schema backup is not sufficient for A2.

4. Complete the evidence record below and have the lead verify it before the migration window. If the backup, checksum, restore rehearsal or evidence is missing, stop; do not apply 0015.
5. Immediately before apply, pause staging writes for the change window and take a second backup if any staging data changed since the rehearsed snapshot. Record the exact migration SHA and the pre-apply snapshot identifier.

### Rollback / recovery decision tree

- **Migration fails before COMMIT:** stop the run, capture the SQL error, allow the transaction to roll back, and verify the 0015 objects/constraints are absent or unchanged. Do not retry until the cause is fixed and the disposable PG16 suite is green.
- **Migration committed but application/Edge acceptance fails:** keep the site and Edge action disabled; do not improvise destructive reverse SQL. Because 0015 is additive, prefer restoring the previous application code while leaving the reviewed schema untouched. The lead decides whether a full staging restore is necessary.
- **Staging data must be restored:** restore the verified snapshot into a separate recovery target first, validate Auth + profiles + orders + claims + outbox counts, then have the lead authorize the staging recovery. A full restore rewinds all staging writes after the snapshot; record and reconcile that loss before replacing staging.
- **A2 synthetic-customer test needs recovery:** restore the pre-A2 snapshot into an isolated recovery target or recreate the synthetic fixture. Do not attempt to reconstruct the customer's old email, metadata, claims or outbox payload by hand. No real-customer A2 operation is permitted in this release gate.
- Never restore a staging dump into production. Never remove the sole-Admin guard or create a second Admin identity as a recovery shortcut.

### Required evidence fields (complete before apply)

| Evidence | Recorded value |
|---|---|
| Staging project reference + database name | |
| Backup file / provider snapshot ID | |
| Backup UTC timestamp + operator | |
| SHA-256 checksum | |
| `pg_restore --list` output location | |
| Isolated restore target + restore result | |
| Baseline vs restored counts (orders / profiles / claims / outbox / auth.users / auth.identities) | |
| Lead backup + restore approval and timestamp | |
| Pre-apply snapshot ID + migration SHA | |
| Recovery decision owner | |

## Disposable PostgreSQL 16 behavior run

Build a fresh disposable database using the repository's documented schema chain through 0014, then apply 0015 to that disposable database. Run:

    DATABASE_URL="$DISPOSABLE_PG16_URL" bash tests/sql/run-one.sh tests/sql/admin-team-access-behaviour.sql

Expected coverage:
- Admin-only team list, grant, revoke, pending invitation and verified-email activation.
- Manager cannot read the Admin team directory or access another branch; the Manager operational payload contains no PII/payment/tax/financial columns.
- Orders account is branch-linked and cannot be removed through the ordinary named-team action.
- A1 search by name/email/phone/member number, bounded pages, deep offsets and a 1,000-customer fixture.
- A2 rejects non-customer/team/Orders identities before Auth mutation; requires a reason; scrubs Auth/profile/order contact + free-text note data, pending/claimed guest emails and durable outbox PII; disables directory visibility; retires the member number; suspends membership; and retains points ledger + order financial history. Duplicate/lost-response retry is idempotent.
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

The function supports Admin-checked team assignment/removal, branch Orders account provision/reset, and customer anonymization. The anonymization action preflights the customer profile, team roles and branch Orders identity before Auth mutation; after an RPC error it re-reads the durable anonymization marker before deciding whether restoring the saved Auth state is safe. It sends no email. Branch Orders password creation/reset requires 16+ characters; the password is not read back or stored in browser state after completion.

## Staging acceptance (Muse / lead)

1. As Admin, add an existing verified Manager and Staff identity, each assigned to a branch; confirm the Manager lands in admin.html, Staff lands in staff.html.
2. Create one branch Orders account and verify it can open only that branch's kitchen queue; reset its password and verify the old password no longer works. No email is sent.
3. Remove a named Staff user; confirm server-side access is denied on the next request. Confirm the owner/Admin root cannot be demoted or removed.
4. Exercise A1 with at least 1,000 synthetic staging customers; verify page size stays bounded and search matches all four fields.
5. Exercise A2 only with a disposable staging customer; verify Auth sign-in is banned, Auth email/phone/identity metadata scrubbed, profile/order contact + customer note PII scrubbed, pending and claimed points-claim emails replaced, outbox recipient/payload PII removed, member number retired, directory exclusion, and ledger/order/tax aggregates retained. Repeat the same request to verify idempotent success and no duplicate audit event.
6. Confirm Manager branch RPC exposes no customer PII, payment state, subtotal, discount or HST.
7. Walk EN/FR/AR at 320 / 390 / 1280 px, including signed-out, forbidden, loading, empty, error, stale, success and sign-out states.

## Release boundaries

- No production apply or deploy in this task.
- No real email sending, outbox, SMTP, sign-up activation, payment activation or booking activation.
- No points adjustment (T-13), refund/cancel (T-20), menu management (T-21), or reports (T-25/T-26) implementation in this branch.
- T-06 Reject remains untouched.
- Do not treat UI hiding as authorization; every function/RPC enforces Admin or branch role server-side.
