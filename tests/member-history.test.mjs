import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const H = require("../member-history.js");
const CFG = { url: "https://x.supabase.co", anonKey: "anon" };
const S = { access_token: "T", user: { id: "u-1" } };

test("reads only the signed-in member's own orders and ledger (explicit user_id filter), newest first", async () => {
  const urls = [];
  const h = H.createHistory({ config: CFG, getSession: async () => S, fetch: async (u, o) => { urls.push([decodeURIComponent(u), o.headers.Authorization]); return { ok: true, json: async () => (u.includes("points_ledger") ? [{ delta_points: 120 }, { delta_points: -50 }] : []) }; } });
  const d = await h.load();
  assert.equal(d.total, 70);
  assert.match(urls[0][0], /\/rest\/v1\/orders\?select=id,placed_at,pickup_slot,fulfilment_status,payment_status,total_cents,order_items\(/);
  assert.match(urls[0][0], /&user_id=eq\.u-1&order=placed_at\.desc&limit=20$/);
  assert.match(urls[1][0], /\/rest\/v1\/points_ledger\?select=entry_type,delta_points,created_at,order_id&user_id=eq\.u-1&order=created_at\.desc/);
  assert.ok(urls.every(([, a]) => a === "Bearer T"));
});

test("signed out or no config: nothing is fetched", async () => {
  let n = 0;
  const f = async () => { n++; return { ok: true, json: async () => [] }; };
  assert.equal(await H.createHistory({ config: CFG, getSession: async () => null, fetch: f }).load(), null);
  assert.equal(H.createHistory({ config: { url: null, anonKey: null }, fetch: f }).enabled, false);
  assert.equal(n, 0);
});

test("history renders with textContent only; member page loads it after checkout.js", () => {
  const src = readFileSync(new URL("../member-history.js", import.meta.url), "utf8");
  assert.doesNotMatch(src, /innerHTML/);
  const h = readFileSync(new URL("../member.html", import.meta.url), "utf8");
  const v = h.match(/script\.js\?v=([\w-]+)"/)[1];
  assert.ok(h.indexOf(`checkout.js?v=${v}`) < h.indexOf(`member-history.js?v=${v}`));
});

test("V3 cups = collected paid orders (earn rows minus reversals), never negative; number shown separately", () => {
  assert.equal(H.cupsFrom([]), 0);
  assert.equal(H.cupsFrom([{ entry_type: "earn" }, { entry_type: "earn" }, { entry_type: "redeem" }]), 2);
  assert.equal(H.cupsFrom([{ entry_type: "earn" }, { entry_type: "earn_reversal" }]), 0);
  assert.equal(H.cupsFrom([{ entry_type: "earn_reversal" }]), 0);
  const src = readFileSync(new URL("../member-history.js", import.meta.url), "utf8");
  assert.match(src, /"mh-balance", L\("total"/, "the exact balance line is still rendered");
});

