import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL") || "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: cors });
const clean = (v: unknown, max = 500) => typeof v === "string" ? v.trim().slice(0, max) : "";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply(405, { error: "method_not_allowed" });
  if (!url || !anonKey || !serviceKey) return reply(503, { error: "server_configuration_missing" });

  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return reply(401, { error: "signed_out" });

  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: authData, error: authError } = await caller.auth.getUser();
  if (authError || !authData.user) return reply(401, { error: "signed_out" });
  const { data: isAdmin, error: roleError } = await caller.rpc("azal_is_admin");
  if (roleError || isAdmin !== true) return reply(403, { error: "not_admin" });

  const service = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return reply(400, { error: "invalid_json" }); }
  const action = clean(body.action, 40);

  try {
    if (action === "team_assign") {
      const { data, error } = await caller.rpc("azal_admin_team_assign", {
        p_email: clean(body.email, 254),
        p_display_name: clean(body.display_name, 80),
        p_role: clean(body.role, 20),
        p_branch_slugs: Array.isArray(body.branch_slugs) ? body.branch_slugs.filter((x): x is string => typeof x === "string").slice(0, 20) : [],
        p_reason: clean(body.reason, 500) || null
      });
      if (error) return reply(400, { error: error.message });
      return reply(200, data || { status: "ok" });
    }

    if (action === "team_remove") {
      const { data, error } = await caller.rpc("azal_admin_team_remove", {
        p_user_id: clean(body.user_id, 64),
        p_reason: clean(body.reason, 500)
      });
      if (error) return reply(400, { error: error.message });
      return reply(200, data || { status: "ok" });
    }

    if (action === "team_invite_revoke") {
      const { data, error } = await caller.rpc("azal_admin_team_invite_revoke", {
        p_invite_id: clean(body.invite_id, 64),
        p_reason: clean(body.reason, 500)
      });
      if (error) return reply(400, { error: error.message });
      return reply(200, data || { status: "revoked" });
    }

    if (action === "customer_anonymize") {
      const userId = clean(body.user_id, 64);
      const reason = clean(body.reason, 500);
      if (!userId || !reason) return reply(400, { error: "reason_required" });
      const { data: targetData, error: targetError } = await service.auth.admin.getUserById(userId);
      if (targetError || !targetData.user?.email) return reply(404, { error: "customer_not_found" });
      const oldEmail = targetData.user.email;
      const replacement = `removed+${userId.replaceAll("-", "")}@example.invalid`;
      const bannedUntil = targetData.user.banned_until ? Date.parse(targetData.user.banned_until) : 0;
      const wasBanned = Number.isFinite(bannedUntil) && bannedUntil > Date.now();
      const previousBanDuration = wasBanned ? `${Math.max(1, Math.ceil((bannedUntil - Date.now()) / 3600000))}h` : "none";
      const { error: banError } = await service.auth.admin.updateUserById(userId, {
        email: replacement,
        email_confirm: true,
        user_metadata: {},
        ban_duration: "876000h"
      });
      if (banError) return reply(502, { error: "account_deactivation_failed" });
      const { data, error } = await service.rpc("azal_admin_anonymize_customer_server", {
        p_actor_id: authData.user.id,
        p_user_id: userId,
        p_reason: reason
      });
      if (error) {
        await service.auth.admin.updateUserById(userId, {
          email: oldEmail,
          email_confirm: true,
          ban_duration: "none"
        });
        return reply(400, { error: error.message });
      }
      return reply(200, data || { status: "anonymized" });
    }

    if (action === "orders_provision") {
      const branch = clean(body.branch_slug, 80);
      const email = clean(body.email, 254).toLowerCase();
      const password = typeof body.password === "string" ? body.password : "";
      if (!branch || !email || password.length < 16 || password.length > 128) {
        return reply(400, { error: "branch_email_and_16_character_password_required" });
      }
      const { data: pendingInvite } = await service.from("admin_team_invites").select("id")
        .eq("email", email).is("accepted_at", null).is("revoked_at", null).maybeSingle();
      if (pendingInvite) return reply(409, { error: "orders_email_has_pending_team_invite" });
      const { data: created, error: createError } = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });
      if (createError || !created.user) return reply(400, { error: createError?.message || "orders_account_creation_failed" });
      const { data, error } = await caller.rpc("azal_admin_link_orders_account", {
        p_branch_slug: branch,
        p_user_id: created.user.id,
        p_email: email
      });
      if (error) {
        await service.auth.admin.deleteUser(created.user.id);
        await service.from("memberships").delete().eq("user_id", created.user.id);
        await service.from("profiles").delete().eq("id", created.user.id);
        return reply(400, { error: error.message });
      }
      return reply(200, data || { status: "linked" });
    }

    if (action === "orders_reset") {
      const branch = clean(body.branch_slug, 80);
      const password = typeof body.password === "string" ? body.password : "";
      const reason = clean(body.reason, 500);
      if (!branch || password.length < 16 || password.length > 128 || !reason) {
        return reply(400, { error: "branch_16_character_password_and_reason_required" });
      }
      const { data: account, error: lookupError } = await service
        .from("branch_orders_accounts").select("auth_user_id").eq("branch_slug", branch).maybeSingle();
      if (lookupError || !account) return reply(404, { error: "orders_account_not_found" });
      const { error: requestAuditError } = await caller.rpc("azal_admin_orders_password_audit", {
        p_branch_slug: branch, p_phase: "requested", p_reason: reason
      });
      if (requestAuditError) return reply(500, { error: "password_reset_audit_failed" });
      const { error: updateError } = await service.auth.admin.updateUserById(account.auth_user_id, { password });
      if (updateError) {
        await caller.rpc("azal_admin_orders_password_audit", {
          p_branch_slug: branch, p_phase: "failed", p_reason: reason
        });
        return reply(502, { error: "orders_password_reset_failed" });
      }
      const { error: completedAuditError } = await caller.rpc("azal_admin_orders_password_audit", {
        p_branch_slug: branch, p_phase: "completed", p_reason: reason
      });
      if (completedAuditError) return reply(500, { error: "password_changed_completion_audit_pending" });
      return reply(200, { status: "password_reset" });
    }

    return reply(400, { error: "unknown_action" });
  } catch {
    return reply(500, { error: "internal_error" });
  }
});
