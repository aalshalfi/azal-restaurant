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


test("T-14 kitchen branch list comes from server assignments and cannot be switched outside scope", async () => {
  const calls=[];
  const s=T.createStaff({config:CFG,getToken:async()=>"STAFF",fetch:async(u,o)=>{
    calls.push([u,o]);
    if(u.includes("azal_staff_my_branches"))return {ok:true,json:async()=>["second","ottawa"]};
    if(u.includes("azal_staff_can_access"))return {ok:true,json:async()=>true};
    return {ok:true,json:async()=>[]};
  }});
  assert.deepEqual(await s.branches(),["second","ottawa"]);
  assert.equal(s.setBranch("second"),"second");
  assert.equal(s.currentBranch(),"second");
  await s.isStaff();
  await s.list();
  assert.ok(calls.some(([u])=>u.includes("branch_slug=eq.second")));
  assert.throws(()=>s.setBranch("other"),{code:"bad_branch"});
});


test("T-26 today summary is fetched through the staff-only RPC for the selected branch", async () => {
  const calls = [];
  const s = T.createStaff({ config: CFG, getToken: async () => "STAFF", fetch: async (url, options) => {
    calls.push([url, JSON.parse(options.body)]);
    return { ok: true, json: async () => ({ branch_slug: "ottawa", net_collected_cents: 1234 }) };
  }});
  const result = await s.todaySummary();
  assert.equal(result.net_collected_cents, 1234);
  assert.equal(calls[0][0], "https://x.supabase.co/rest/v1/rpc/azal_staff_today_summary");
  assert.deepEqual(calls[0][1], { p_branch_slug: "ottawa" });
});


test("T-28 History query is limited to today's completed branch orders and omits customer contact and totals", async () => {
  const calls = [];
  const s = T.createStaff({ config: CFG, getToken: async () => "STAFF", fetch: async (url) => {
    calls.push(url);
    return { ok: true, json: async () => [{ id:"closed-order", fulfilment_status:"handed_over" }] };
  }});
  const rows = await s.history();
  assert.equal(rows[0].fulfilment_status, "handed_over");
  const u = new URL(calls[0]);
  assert.equal(u.pathname, "/rest/v1/orders");
  assert.equal(u.searchParams.get("branch_slug"), "eq.ottawa");
  assert.equal(u.searchParams.get("payment_status"), "in.(paid,refunded)");
  assert.equal(u.searchParams.get("fulfilment_status"), "in.(handed_over,cancelled)");
  assert.ok(u.searchParams.get("placed_at").startsWith("gte."));
  assert.ok(u.searchParams.getAll("placed_at").some(v => v.startsWith("lt.")));
  assert.equal(u.searchParams.get("limit"), "100");
  assert.doesNotMatch(u.searchParams.get("select"), /guest_name|contact_phone|total_cents/);
  const start = Date.parse(u.searchParams.getAll("placed_at").find(v=>v.startsWith("gte.")).slice(4));
  const end = Date.parse(u.searchParams.getAll("placed_at").find(v=>v.startsWith("lt.")).slice(3));
  assert.ok([23,24,25].includes((end-start)/3600000), "Toronto day range handles daylight-saving boundaries");
});
