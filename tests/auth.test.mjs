// ACCT auth wiring (Claude): plain-fetch Supabase client, tested against a fake server. No network.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { createAuth, KEY } = require(path.join(root, "auth.js"));

const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };
const json = (status, body) => ({ ok: status < 400, status, json: async () => body });
const CFG = { url: "https://example.invalid/", anonKey: "anon-test" };
function server(routes) {
  const calls = [];
  const fetch = async (url, init) => { calls.push({ url, init }); for (const [re, fn] of routes) if (re.test(url)) return fn(url, init); return json(404, { message: "not found" }); };
  return { fetch, calls };
}
const tok = (extra = {}) => ({ access_token: "A1", refresh_token: "R1", expires_in: 3600, user: { id: "u-1", email: "a@example.invalid" }, ...extra });

test("inert without config: no requests, state inert", async () => {
  const s = server([]);
  const a = createAuth({ config: { url: null, anonKey: null }, fetch: s.fetch, storage: mem() });
  assert.equal(a.enabled, false);
  assert.deepEqual(await a.state(), { status: "inert" });
  await assert.rejects(a.signIn("x", "y"), { code: "disabled" });
  assert.equal(s.calls.length, 0);
});

test("sign in stores the session; requests carry apikey and bearer", async () => {
  const st = mem();
  const s = server([
    [/token\?grant_type=password/, () => json(200, tok())],
    [/profiles/, () => json(200, [{ id: "u-1", display_name: "Amal" }])],
    [/memberships/, () => json(200, [{ status: "active" }])],
    [/points_ledger/, () => json(200, [{ delta_points: 250 }, { delta_points: 129 }, { delta_points: -100 }])]
  ]);
  const a = createAuth({ config: CFG, fetch: s.fetch, storage: st, now: () => 1e12 });
  await a.signIn("a@example.invalid", "secret123");
  assert.ok(JSON.parse(st.getItem(KEY)).access_token === "A1");
  const state = await a.state();
  assert.deepEqual(state, { status: "signed_in", email: "a@example.invalid", name: "Amal", membership: "active", points: 279 });
  const q = s.calls.find((c) => /points_ledger/.test(c.url));
  assert.equal(q.init.headers.apikey, "anon-test");
  assert.equal(q.init.headers.Authorization, "Bearer A1");
  assert.match(q.url, /^https:\/\/example\.invalid\/rest\/v1\/points_ledger\?select=delta_points&user_id=eq\.u-1$/);
});

test("signed in but the profile trigger has not run yet -> no_profile", async () => {
  const st = mem(); st.setItem(KEY, JSON.stringify({ access_token: "A1", refresh_token: "R1", expires_at: 2e12, user: { id: "u-1", email: "a@example.invalid" } }));
  const s = server([[/profiles/, () => json(200, [])], [/memberships/, () => json(200, [])], [/points_ledger/, () => json(200, [])]]);
  const a = createAuth({ config: CFG, fetch: s.fetch, storage: st, now: () => 1e12 });
  assert.equal((await a.state()).status, "no_profile");
});

test("expired access token is refreshed once; failed refresh signs out", async () => {
  const st = mem(); st.setItem(KEY, JSON.stringify({ access_token: "OLD", refresh_token: "R1", expires_at: 5, user: { id: "u-1" } }));
  const s = server([[/grant_type=refresh_token/, () => json(200, tok({ access_token: "NEW" }))]]);
  const a = createAuth({ config: CFG, fetch: s.fetch, storage: st, now: () => 1e12 });
  assert.equal((await a.session()).access_token, "NEW");
  const st2 = mem(); st2.setItem(KEY, JSON.stringify({ access_token: "OLD", refresh_token: "BAD", expires_at: 5 }));
  const b = createAuth({ config: CFG, fetch: server([[/grant_type=refresh_token/, () => json(400, { error: "invalid_grant" })]]).fetch, storage: st2, now: () => 1e12 });
  assert.equal(await b.session(), null);
  assert.equal(st2.getItem(KEY), null);
});

test("sign up with email confirmation on: no session, confirm=true", async () => {
  const st = mem();
  const a = createAuth({ config: CFG, fetch: server([[/signup/, () => json(200, { id: "u-2", email: "b@example.invalid" })]]).fetch, storage: st });
  assert.deepEqual(await a.signUp("b@example.invalid", "secret123"), { session: null, confirm: true });
  assert.equal(st.getItem(KEY), null);
});

test("sign out clears storage even if the server call fails", async () => {
  const st = mem(); st.setItem(KEY, JSON.stringify({ access_token: "A1", expires_at: 2e12 }));
  const a = createAuth({ config: CFG, fetch: async () => { throw new Error("offline"); }, storage: st });
  await a.signOut();
  assert.equal(st.getItem(KEY), null);
});

test("server errors map to stable codes", async () => {
  const cases = [[400, { error_description: "Invalid login credentials" }, "invalid_credentials"], [400, { msg: "Email not confirmed" }, "email_not_confirmed"],
    [422, { msg: "User already registered" }, "already_registered"], [422, { msg: "Signups not allowed for this instance" }, "signups_closed"],
    [422, { msg: "Password should be at least 8 characters" }, "weak_password"], [429, { msg: "slow down" }, "rate_limited"]];
  for (const [status, body, code] of cases) {
    const a = createAuth({ config: CFG, fetch: async () => json(status, body), storage: mem() });
    await assert.rejects(a.signIn("x@example.invalid", "y"), { code });
  }
  const n = createAuth({ config: CFG, fetch: async () => { throw new TypeError("Failed to fetch"); }, storage: mem() });
  await assert.rejects(n.signIn("x@example.invalid", "y"), { code: "network" });
});

test("repo ships inert: config empty, no secret-looking keys, member page has no form in HTML", () => {
  const cfg = fs.readFileSync(path.join(root, "supabase-config.js"), "utf8");
  assert.match(cfg, /url: null,\s*anonKey: null/);
  for (const f of ["supabase-config.js", "auth.js", "script.js"]) assert.ok(!/service_role|eyJ[A-Za-z0-9_-]{20,}/.test(fs.readFileSync(path.join(root, f), "utf8")), f);
  const member = fs.readFileSync(path.join(root, "member.html"), "utf8");
  assert.ok(!/<form|<input/.test(member));
});

test("email code: request then verify stores a session; bad code maps to code_invalid", async () => {
  const st = mem();
  const s = server([
    [/\/auth\/v1\/otp$/, (u, init) => { const b = JSON.parse(init.body); return b.create_user === true && b.email ? json(200, {}) : json(400, {}); }],
    [/\/auth\/v1\/verify$/, (u, init) => JSON.parse(init.body).token === "123456" ? json(200, tok()) : json(403, { msg: "Token has expired or is invalid" })]
  ]);
  const a = createAuth({ config: CFG, fetch: s.fetch, storage: st, now: () => 1e12 });
  assert.equal(await a.requestCode("a@example.invalid"), true);
  await assert.rejects(a.verifyCode("a@example.invalid", "000000"), { code: "code_invalid" });
  assert.equal(st.getItem(KEY), null);
  await a.verifyCode("a@example.invalid", "123456");
  assert.equal(JSON.parse(st.getItem(KEY)).access_token, "A1");
  assert.equal(JSON.parse(s.calls.find((c) => /verify/.test(c.url)).init.body).type, "email");
});

test("code request rate limit maps to rate_limited", async () => {
  const a = createAuth({ config: CFG, fetch: async () => json(429, { msg: "For security purposes, you can only request this after 52 seconds." }), storage: mem() });
  await assert.rejects(a.requestCode("a@example.invalid"), { code: "rate_limited" });
});

test("guest points claim: calls the RPC with the session, returns points; 0 when missing", async () => {
  const st = mem(); st.setItem(KEY, JSON.stringify({ access_token: "A1", refresh_token: "R1", expires_at: 2e12, user: { id: "u-1" } }));
  const s = server([[/rpc\/claim_guest_points/, () => json(200, { points_added: 249 })]]);
  const a = createAuth({ config: CFG, fetch: s.fetch, storage: st, now: () => 1e12 });
  assert.deepEqual(await a.claimGuestPoints(), { added: 249, failed: false });
  assert.equal(s.calls[0].init.method, "POST");
  assert.equal(s.calls[0].init.headers.Authorization, "Bearer A1");
  const b = createAuth({ config: CFG, fetch: server([]).fetch, storage: st, now: () => 1e12 });
  assert.deepEqual(await b.claimGuestPoints(), { added: 0, failed: true }, "a failed call is reported, not shown as zero");
  const z = createAuth({ config: CFG, fetch: server([[/rpc\/claim_guest_points/, () => json(200, { points_added: 0 })]]).fetch, storage: st, now: () => 1e12 });
  assert.deepEqual(await z.claimGuestPoints(), { added: 0, failed: false }, "a real zero is not a failure");
  const n = createAuth({ config: CFG, fetch: server([]).fetch, storage: mem(), now: () => 1e12 });
  assert.deepEqual(await n.claimGuestPoints(), { added: 0, failed: false });
});

test("requestCode refuses a malformed email before sending anything", async () => {
  const s = server([[/otp/, () => json(200, {})]]);
  const a = createAuth({ config: CFG, fetch: s.fetch, storage: mem(), now: () => 1e12 });
  for (const bad of ["", "nobody", "a@b", "a b@c.de"]) await assert.rejects(a.requestCode(bad), { code: "invalid_email" });
  assert.equal(s.calls.length, 0);
});
