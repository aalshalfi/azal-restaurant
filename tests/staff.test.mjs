import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const T = require("../staff.js");
const CFG = { url: "https://x.supabase.co", anonKey: "anon" };

test("next action per status: accept -> ready -> hand over; closed orders have none", () => {
  assert.deepEqual(T.NEXT, { placed: "accept", accepted: "ready", preparing: "ready", ready: "hand_over" });
  assert.equal(T.code("9f3c2a10-0000"), "9F3C2A");
});

test("list asks only for PAID, open orders of the branch, by pickup slot, with items", async () => {
  const calls = [];
  const s = T.createStaff({ config: CFG, getToken: async () => "STAFF", fetch: async (u, o) => { calls.push([u, o]); return { ok: true, json: async () => [] }; } });
  await s.list();
  const u = decodeURIComponent(calls[0][0]);
  assert.match(u, /\/rest\/v1\/orders\?/);
  assert.match(u, /payment_status=eq\.paid/);
  assert.match(u, /fulfilment_status=not\.in\.\(handed_over,cancelled\)/);
  assert.match(u, /branch_slug=eq\.ottawa/);
  assert.match(u, /order_items\(quantity,item_name_en_snapshot,item_name_fr_snapshot\)/);
  assert.equal(calls[0][1].headers.Authorization, "Bearer STAFF");
});

test("act goes only through staff_update_order with a known action", async () => {
  const calls = [];
  const s = T.createStaff({ config: CFG, getToken: async () => "STAFF", fetch: async (u, o) => { calls.push([u, JSON.parse(o.body)]); return { ok: true, json: async () => ({}) }; } });
  await s.act("o1", "hand_over");
  assert.deepEqual(calls[0], ["https://x.supabase.co/rest/v1/rpc/staff_update_order", { p_order: "o1", p_action: "hand_over" }]);
  await assert.rejects(s.act("o1", "mark_paid"), { code: "bad_transition" });
  assert.equal(calls.length, 1);
});

test("reject requires a nonblank reason and sends the trimmed reason to the guarded RPC", async () => {
  const calls = [];
  const s = T.createStaff({ config: CFG, getToken: async () => "STAFF", fetch: async (u, o) => { calls.push(JSON.parse(o.body)); return { ok: true, json: async () => ({}) }; } });
  for (const reason of [undefined, "", " \t\n "]) await assert.rejects(s.act("o1", "reject", reason), { code: "reason_required" });
  await assert.rejects(s.act("o1", "reject", "x".repeat(501)), { code: "reason_too_long" });
  assert.equal(calls.length, 0);
  await s.act("o1", "reject", "  Sold out  ");
  assert.deepEqual(calls, [{ p_order: "o1", p_action: "reject", p_reason: "Sold out" }]);
});

test("signed out and server errors surface as codes", async () => {
  const s = T.createStaff({ config: CFG, getToken: async () => null, fetch: async () => ({ ok: true, json: async () => [] }) });
  await assert.rejects(s.list(), { code: "signed_out" });
  const e = T.createStaff({ config: CFG, getToken: async () => "T", fetch: async () => ({ ok: false, status: 400, json: async () => ({ message: "bad_transition" }) }) });
  await assert.rejects(e.act("o", "ready"), { code: "bad_transition" });
});

test("staff page is not indexed, not in the nav, inert with shipped config", () => {
  const h = readFileSync(new URL("../staff.html", import.meta.url), "utf8");
  assert.match(h, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(h, /auth\.js\?v=([\w-]+)" defer><\/script><script src="sigil\.js\?v=\1" defer><\/script><script src="checkout\.js\?v=\1" defer><\/script><script src="staff\.js\?v=\1" defer><\/script>/);
  for (const p of ["index", "menu", "member", "reserve", "story", "404"]) assert.doesNotMatch(readFileSync(new URL(`../${p}.html`, import.meta.url), "utf8"), /href="staff\.html"/);
  assert.equal(T.createStaff({ config: { url: null, anonKey: null }, fetch: async () => {} }).enabled, false);
});
