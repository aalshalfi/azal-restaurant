// T-14 team access and A1/A2 controls. Run: node --test tests/admin-team.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");

test("0015 extends the existing role model; Admin and Manager checks are server-side", () => {
  const sql=read("supabase/migrations/0015_admin_team_access.sql");
  assert.ok(sql.includes("create or replace function public.azal_admin_audit_recent"));
  assert.ok(sql.includes("create or replace function public.azal_staff_my_branches"));
  assert.match(sql,/role in \('customer','staff','admin','manager'\)/);
  assert.match(sql,/create or replace function public\.azal_is_manager\(\)[\s\S]*security definer[\s\S]*set search_path = ''/);
  assert.match(sql,/create or replace function public\.azal_manager_can_access\(p_branch_slug text\)[\s\S]*r\.role = 'manager'[\s\S]*a\.branch_slug = p_branch_slug/);
  assert.match(sql,/not public\.azal_is_admin\(\)/);
  assert.match(sql,/revoke all on public\.admin_audit_log from public, anon, authenticated/);
  assert.match(sql,/revoke all on public\.branch_orders_accounts from public, anon, authenticated/);
});

test("A1 all-orders list is contact-blind until one order detail is opened", () => {
  const admin=read("admin.js");
  const list=admin.slice(admin.indexOf("async orders("),admin.indexOf("async orderDetail("));
  const detail=admin.slice(admin.indexOf("async orderDetail("),admin.indexOf("const api ="));
  assert.doesNotMatch(list,/guest_name|guest_email|contact_phone|azal_admin_order_customer_emails|rest\/v1\/profiles/);
  assert.match(detail,/azal_admin_customer_contact/);
  assert.doesNotMatch(read("supabase/migrations/0015_admin_team_access.sql"),/create or replace function public\.azal_admin_order_customer_emails/);
  assert.match(admin,/Search order code or branch/);
});
test("A1 directory search and pagination run in a fixed-path Admin RPC with a hard page cap", () => {
  const sql=read("supabase/migrations/0015_admin_team_access.sql");
  const fn=sql.slice(sql.indexOf("create or replace function public.azal_admin_customer_directory_page"),sql.indexOf("create or replace function public.azal_admin_team_list"));
  assert.match(fn,/security definer[\s\S]*set search_path = ''/);
  assert.match(fn,/auth\.uid\(\) is null or not public\.azal_is_admin\(\)/);
  assert.match(fn,/least\(coalesce\(p_limit, 50\), 100\)/);
  assert.match(fn,/greatest\(0, least\(coalesce\(p_offset, 0\), 100000\)\)/);
  for(const field of ["display_name","phone","u.email","member_number::text"]) assert.ok(fn.includes(field),field+" search is required");
  assert.match(fn,/from public\.points_ledger l where l\.user_id = page\.user_id/,"ledger balance is aggregated only after page CTE");
  assert.match(fn,/member_number_retired/);
});

test("A2 anonymization is server-only, reason-required, and preserves append-only history", () => {
  const sql=read("supabase/migrations/0015_admin_team_access.sql");
  const fn=sql.slice(sql.indexOf("create or replace function public.azal_admin_anonymize_customer_server"),sql.indexOf("-- Apply pending in-portal invitations"));
  assert.ok(fn.includes("p_actor_id is null or not exists"));
  assert.ok(fn.includes("r.role='admin'"));
  assert.ok(fn.includes("reason_required"));
  assert.ok(fn.includes("update auth.users"));
  assert.ok(fn.includes("raw_user_meta_data='{}'::jsonb"));
  assert.ok(fn.includes("update auth.identities"));
  assert.match(fn,/display_name=null, phone=null,[\s\S]*anonymized_at=coalesce\(anonymized_at/);
  assert.ok(fn.includes("member_number_retired=true"));
  assert.ok(fn.includes("update public.memberships set status='suspended'"));
  assert.ok(fn.includes("contact_phone=null, guest_name=null, guest_email=null"));
  assert.ok(!/delete from public\.(orders|points_ledger|order_items)/.test(fn));
  assert.ok(fn.includes("customer_anonymized"));
  assert.ok(fn.includes("update public.points_claims"));
  assert.ok(fn.includes("update public.order_outbox"));
  assert.ok(fn.includes("already_anonymized"));
  assert.ok(sql.includes("grant execute on function public.azal_admin_anonymize_customer_server(uuid,uuid,text,text) to service_role"));
});
test("Team invitations are in-portal only and activate only after verified email", () => {
  const sql=read("supabase/migrations/0015_admin_team_access.sql");
  const invite=sql.slice(sql.indexOf("create or replace function public.azal_admin_team_assign"),sql.indexOf("create or replace function public.azal_admin_team_remove"));
  const trigger=sql.slice(sql.indexOf("create or replace function public.azal_apply_team_invite"),sql.indexOf("create or replace function public.azal_manager_branch_orders"));
  assert.match(invite,/pending_account/);
  assert.match(invite,/no email sent/i);
  assert.match(trigger,/new\.email_confirmed_at is null/);
  assert.match(trigger,/team_invite_accepted/);
  const edge=read("supabase/functions/admin-team-access/index.ts");
  assert.doesNotMatch(edge,/inviteUserByEmail|sendEmail|smtp/i);
});

test("branch Orders credentials are branch-owned, Admin-gated, and use server-only service key", () => {
  const sql=read("supabase/migrations/0015_admin_team_access.sql");
  assert.match(sql,/create table if not exists public\.branch_orders_accounts/);
  assert.match(sql,/branch_slug text primary key/);
  assert.match(sql,/auth_user_id uuid not null unique/);
  const edge=read("supabase/functions/admin-team-access/index.ts");
  assert.match(edge,/SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(edge,/azal_admin_anonymize_customer_server/);
  assert.match(read("supabase/functions/admin-team-access/auth-state.mjs"),/ban_duration: "876000h"/);
  assert.match(edge,/auth\.admin\.createUser/);
  assert.match(edge,/auth\.admin\.updateUserById/);
  assert.doesNotMatch(edge,/console\.(log|info|debug)\(/);
  assert.match(edge,/password\.length < 16/);
});

test("Manager order RPC returns branch-only operational data and excludes financial/PII fields", () => {
  const sql=read("supabase/migrations/0015_admin_team_access.sql");
  const fn=sql.slice(sql.indexOf("create or replace function public.azal_manager_branch_orders"),sql.lastIndexOf("commit;"));
  assert.match(fn,/azal_manager_can_access\(p_branch_slug\)/);
  assert.match(fn,/where o\.branch_slug=p_branch_slug/);
  assert.doesNotMatch(fn,/payment_status|tax_cents|subtotal_cents|total_cents|email|phone/);
});

test("Admin UI uses safe DOM APIs, mandatory reasons and server mutation paths", () => {
  const ui=read("admin-team.js"), admin=read("admin.js"), role=read("role-door.js"), html=read("admin.html");
  assert.doesNotMatch(ui,/innerHTML/);
  assert.match(ui,/customer_anonymize/);
  assert.match(ui,/team_assign/);
  assert.match(ui,/orders_provision/);
  assert.match(ui,/orders_reset/);
  assert.match(ui,/azal_admin_audit_recent/);
  assert.match(ui,/renewInvite/);
  assert.match(ui,/Pending access renewed in portal/);
  assert.match(ui,/adminTeamAudit/);
  assert.match(ui,/adminTeamSearch/);
  assert.match(ui,/adminTeamRole/);
  assert.match(ui,/adminTeamBranch/);
  assert.match(ui,/adminTeamStatus/);
  const addRoleSelect=ui.slice(ui.indexOf("const roleSelect"),ui.indexOf("form.append",ui.indexOf("const roleSelect")));
  assert.doesNotMatch(addRoleSelect,/\["admin","admin"\]/);
  assert.match(ui,/reason\.required=true/);
  assert.match(ui,/why\.required=true/);
  assert.match(admin,/azal_admin_customer_directory_page/);
  assert.match(admin,/directoryPage/);
  assert.match(role,/role === "manager"/);
  assert.match(role,/r === "admin" \|\| r === "manager"/);
  assert.match(html,/admin-team\.js\?v=/);
  assert.match(html,/<meta name="robots" content="noindex, nofollow">/);
});


test("sole Admin identity is fixed to the owner's verified email; Team UI cannot grant another Admin", () => {
  const sql=read("supabase/migrations/0015_admin_team_access.sql");
  assert.match(sql,/lower\(u\.email\) = 'info@azalrestaurant\.com'/);
  assert.match(sql,/requires the existing owner Admin identity/);
  assert.match(sql,/non-owner Admin roles to be reconciled/);
  assert.match(sql,/admin_role_reserved/);
  assert.match(sql,/root_admin_protected/);
  assert.match(read("docs/apply-0015.md"),/owner identity.*info@azalrestaurant\.com/i);
  assert.match(read("docs/apply-0015.md"),/Supabase dashboard.*recovery/i);
});


test("A2 preflights customer identity and restores the complete Auth snapshot on SQL failure", () => {
  const edge=read("supabase/functions/admin-team-access/index.ts");
  const auth=read("supabase/functions/admin-team-access/auth-state.mjs");
  assert.ok(edge.indexOf('service.from("profiles")') < edge.indexOf("updateUserById("),"profile and role preflight precedes Auth mutation");
  assert.match(edge,/service\.from\("user_roles"\)/);
  assert.match(edge,/service\.from\("branch_orders_accounts"\)/);
  assert.match(edge,/captureAuthState\(targetUser\)/);
  assert.match(edge,/restoreAuthPatch\(previousAuthState\)/);
  assert.match(edge,/p_email_to_scrub: previousAuthState\.email/);
  assert.match(edge,/anonymization_compensation_failed/);
  assert.match(edge,/afterErrorProfile\.anonymized_at/);
  assert.match(edge,/anonymization_commit_state_unverified/);
  assert.match(edge,/if \(alreadyAnonymized\) return reply\(200, \{ status: "already_anonymized" \}\)/);
  assert.ok(edge.indexOf("if (alreadyAnonymized)") < edge.indexOf("updateUserById("),"idempotent retry exits before any Auth mutation");
  assert.doesNotMatch(edge,/if \(alreadyAnonymized\) return reply\(502/,"a retry must not enter an error/compensation path after the durable marker exists");
  assert.match(auth,/email_confirm: snapshot\.email_confirm/);
  assert.match(auth,/user_metadata: cloneJson\(snapshot\.user_metadata\)/);
  assert.match(auth,/ban_duration: snapshot\.ban_duration/);
});
test("A2 SQL retry is idempotent and scrubs guest claims and durable outbox payloads", () => {
  const sql=read("supabase/migrations/0015_admin_team_access.sql");
  const fn=sql.slice(sql.indexOf("create or replace function public.azal_admin_anonymize_customer_server"),sql.indexOf("-- Apply pending in-portal invitations"));
  assert.match(fn,/update public\.points_claims[\s\S]*guest_email=v_replacement/);
  assert.match(fn,/update public\.order_outbox[\s\S]*payload=[\s\S]*array\[/);
  assert.match(fn,/already_anonymized/);
  assert.match(fn,/if v_anonymized_at is null then[\s\S]*insert into public\.admin_audit_log/);
});
