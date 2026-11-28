// Supabase Edge Function: admin-team-auth
// Server-only Auth Admin API bridge for T-14 customer anonymization.
// Required secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
// The service-role key is never returned to the browser.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!url || !anon || !serviceKey) return json({ error: "server_not_configured" }, 503);

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "unauthorized" }, 401);
  const caller = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: who, error: whoError } = await caller.auth.getUser(token);
  if (whoError || !who.user) return json({ error: "unauthorized" }, 401);
  const { data: admin, error: adminError } = await caller.rpc("azal_is_admin");
  if (adminError || admin !== true) return json({ error: "not_admin" }, 403);

  let input: { action?: string; user_id?: string; reason?: string; request_key?: string };
  try { input = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const userId = String(input.user_id || "");
  const reason = String(input.reason || "").trim();
  const requestKey = String(input.request_key || "");
  if (input.action !== "anonymize_customer" || !/^[0-9a-f-]{36}$/i.test(userId) ||
      !/^[0-9a-f-]{36}$/i.test(requestKey) || reason.length < 8 || reason.length > 500) {
    return json({ error: "invalid_request" }, 400);
  }
  if (userId === who.user.id) return json({ error: "invalid_target" }, 400);

  const service = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: target, error: targetError } = await service.auth.admin.getUserById(userId);
  if (targetError || !target.user) return json({ error: "customer_not_found" }, 404);
  const oldEmail = target.user.email;
  const bannedUntil = target.user.banned_until ? new Date(target.user.banned_until).getTime() : 0;
  const wasBanned = Number.isFinite(bannedUntil) && bannedUntil > Date.now();
  const replacement = `anonymized+${userId}@users.azal.invalid`;

  // Ban first, then replace the sign-in email. The database RPC is the authoritative privacy/audit transaction.
  const { error: authUpdateError } = await service.auth.admin.updateUserById(userId, {
    ban_duration: "876000h",
    email: replacement,
    email_confirm: true,
    user_metadata: {},
  });
  if (authUpdateError) return json({ error: "auth_deactivation_failed" }, 502);

  const { data: result, error: rpcError } = await caller.rpc("azal_admin_anonymize_customer", {
    p_user_id: userId, p_reason: reason, p_request_key: requestKey,
  });
  if (rpcError) {
    // Best-effort compensation: restore the prior email and do not silently unban an account
    // that was already banned before this operation.
    await service.auth.admin.updateUserById(userId, {
      email: oldEmail || replacement,
      email_confirm: true,
      ban_duration: wasBanned ? "876000h" : "none",
    });
    return json({ error: rpcError.code === "23505" ? "duplicate_request" : "anonymize_failed" }, 409);
  }
  return json(result || { user_id: userId, anonymized: true, financial_history_preserved: true });
});
