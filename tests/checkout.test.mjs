import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const C = require("../checkout.js");

test("only the three published test cards map to tokens; anything else is refused", () => {
  assert.equal(C.cardToToken("4242 4242 4242 4242"), "tok_test_ok");
  assert.equal(C.cardToToken("4000-0000-0000-0002"), "tok_test_declined");
  assert.equal(C.cardToToken("4000000000009995"), "tok_test_insufficient");
  for (const n of ["4111111111111111", "5555555555554444", "", null, "4242"]) assert.equal(C.cardToToken(n), null);
});

test("a non-test card sends nothing", async () => {
  const calls = [];
  const co = C.createCheckout({ config: { url: "https://x.supabase.co", anonKey: "anon" }, fetch: async (u, o) => { calls.push([u, o]); return { ok: true, json: async () => ({ order_id: "abc", total_cents: 100, pickup_at: "2026-11-27T17:00:00Z" }) }; } });
  await co.place({ cart: new Map([[1, 1]]), choice: "asap", day: "today", nowMs: Date.now() });
  assert.equal(calls.length, 1);
  await assert.rejects(co.pay("4111 1111 1111 1111"), { code: "not_test_card" });
  assert.equal(calls.length, 1);
  for (const [, o] of calls) assert.doesNotMatch(o.body, /4111|4242|card/i);
});

test("payload carries ids and quantities only: no price, tax or total (U2)", () => {
  const b = C.buildOrder({ cart: new Map([[1, 2], [6, 1]]), choice: "asap", day: "today", note: "  less spice ", key: "k".repeat(20), nowMs: Date.now() });
  assert.deepEqual(b.p_items, [{ menu_item_id: "a2a10000-0000-4000-8000-000000000001", quantity: 2 }, { menu_item_id: "a2a10000-0000-4000-8000-000000000006", quantity: 1 }]);
  assert.equal(b.p_pickup_at, null);
  assert.equal(b.p_note, "less spice");
  assert.doesNotMatch(JSON.stringify(b), /price|total|tax|cents/);
  assert.equal(C.buildOrder({ cart: new Map(), choice: "asap", key: "k", nowMs: 0 }), null);
});

test("Toronto pickup instant is DST-correct", () => {
  const winter = Date.parse("2026-11-26T15:00:00Z"); // EST
  assert.equal(C.torontoInstant(winter, 0, 720), "2026-11-26T17:00:00.000Z");
  assert.equal(C.torontoInstant(winter, 1, 1245), "2026-11-28T01:45:00.000Z");
  const summer = Date.parse("2027-07-01T15:00:00Z"); // EDT
  assert.equal(C.torontoInstant(summer, 0, 720), "2027-07-01T16:00:00.000Z");
  const dst = Date.parse("2027-03-13T15:00:00Z"); // tomorrow is the spring-forward day
  assert.equal(C.torontoInstant(dst, 1, 720), "2027-03-14T16:00:00.000Z");
});

test("guest validation", () => {
  assert.deepEqual(C.validateGuest(" Sara ", " Sara@Example.COM "), { ok: true, name: "Sara", email: "sara@example.com" });
  assert.equal(C.validateGuest("", "a@b.co").field, "name");
  assert.equal(C.validateGuest("A", "not-an-email").field, "email");
});

test("same idempotency key on retry; a placed order is not placed twice", async () => {
  const bodies = [];
  let fail = true;
  const co = C.createCheckout({ config: { url: "https://x.supabase.co", anonKey: "anon" }, fetch: async (u, o) => { bodies.push(JSON.parse(o.body)); if (fail) { fail = false; throw new Error("offline"); } return { ok: true, json: async () => ({ order_id: "o1", total_cents: 6325 }) }; } });
  const args = { cart: new Map([[1, 1]]), choice: "asap", day: "today", nowMs: Date.now() };
  await assert.rejects(co.place(args), { code: "network" });
  await co.place(args); await co.place(args);
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0].p_idempotency_key, bodies[1].p_idempotency_key);
});

test("server error codes pass through", async () => {
  const co = C.createCheckout({ config: { url: "https://x.supabase.co", anonKey: "anon" }, fetch: async () => ({ ok: false, status: 400, json: async () => ({ message: "slot_full" }) }) });
  await assert.rejects(co.place({ cart: new Map([[1, 1]]), choice: "asap", day: "today", nowMs: Date.now() }), { code: "slot_full" });
});

test("inert without config; the shipped config is null or publishable-only", () => {
  assert.equal(C.createCheckout({ config: { url: null, anonKey: null }, fetch: async () => {} }).enabled, false);
  const cfg = readFileSync(new URL("../supabase-config.js", import.meta.url), "utf8");
  assert.match(cfg, /url:\s*null,\s*anonKey:\s*null|anonKey:\s*"sb_publishable_[A-Za-z0-9_-]+"/);
  assert.doesNotMatch(cfg, /service_role|sb_secret_/);
});

test("every page with the order sheet loads checkout.js after auth.js; the table-only reserve page loads none (#32)", () => {
  assert.ok(!readFileSync(new URL("../reserve.html", import.meta.url), "utf8").includes("checkout.js"), "reserve.html: no food checkout");
  for (const p of ["index", "menu", "member", "story", "404"]) {
    const h = readFileSync(new URL(`../${p}.html`, import.meta.url), "utf8");
    const v = h.match(/script\.js\?v=([\w-]+)"/)[1];
    assert.ok(h.indexOf(`auth.js?v=${v}`) < h.indexOf(`checkout.js?v=${v}`) && h.includes(`checkout.js?v=${v}`), p);
  }
});

test("kitchen note: 500 characters pass unchanged; 501 are refused, never cut in silence (ChatGPT #29 review)", () => {
  const base = { cart: new Map([[1, 1]]), choice: "asap", day: "today", key: "k".repeat(20), nowMs: Date.now() };
  const five = "ب".repeat(500);
  assert.equal(C.buildOrder({ ...base, note: five }).p_note, five, "500 Arabic characters arrive exactly");
  assert.equal(C.buildOrder({ ...base, note: "  " + "x".repeat(500) + "  " }).p_note.length, 500, "surrounding spaces do not count");
  assert.throws(() => C.buildOrder({ ...base, note: "x".repeat(501) }), { code: "note_too_long" });
  assert.equal(C.buildOrder({ ...base, note: "   " }).p_note, null, "a blank note is no note");
  const src = readFileSync(new URL("../checkout.js", import.meta.url), "utf8");
  assert.match(src, /<textarea id="coNote" maxlength="500"/, "the field itself stops at 500");
  assert.match(src, /"idempotency_conflict", "note_too_long"[,\]]/, "a refused note unlocks the form");
});

test("F-OWN-4: buildOrder sends p_redeem_points only for a member who chose a reward", () => {
  const base = { cart: new Map([[1, 1]]), choice: "asap", key: "k".repeat(20), nowMs: Date.parse("2026-11-26T17:00:00Z") };
  assert.equal(C.buildOrder(Object.assign({}, base, { redeem: 10000 })).p_redeem_points, 10000);
  assert.ok(!("p_redeem_points" in C.buildOrder(Object.assign({}, base, { redeem: 0 }))), "0 is not sent (old servers keep working)");
  assert.ok(!("p_redeem_points" in C.buildOrder(base)), "absent is not sent");
  assert.ok(!("p_redeem_points" in C.buildOrder(Object.assign({}, base, { redeem: 10000, guest: { name: "A", email: "a@example.invalid" } }))), "guests never send points");
  assert.ok(!("p_redeem_points" in C.buildOrder(Object.assign({}, base, { redeem: 2.5 }))), "non-integers are not sent");
});

test("F-OWN-4 / 0007: only 10,000-point increments are usable and order-bounded", () => {
  const rule = (balance, subtotal = 1000000) => C.redeemView({ balance, step_points: 10000, cents_per_step: 1000, max_steps: 20 }, subtotal);
  assert.deepEqual([rule(9999).usable, rule(9999).next, rule(9999).first], [[], { points: 10000, cents: 1000 }, true], "9,999: no redemption; first reward is 10,000");
  assert.deepEqual(rule(10000).usable, [{ points: 10000, cents: 1000 }], "10,000: $10");
  assert.deepEqual([rule(19999).usable.map((x) => x.points), rule(19999).next.points], [[10000], 20000], "19,999: only $10; next $20");
  assert.deepEqual(rule(20000).usable.map((x) => x.points), [10000, 20000], "20,000: $10/$20");
  assert.deepEqual([rule(29999).usable.map((x) => x.points), rule(29999).next.points], [[10000, 20000], 30000], "29,999: only $10/$20");
  assert.deepEqual(rule(30000).usable.map((x) => x.points), [10000, 20000, 30000], "30,000: $10/$20/$30");
  const belowSubtotal = rule(30000, 999);
  assert.deepEqual([belowSubtotal.usable, belowSubtotal.min], [[], { points: 10000, cents: 1000 }], "discount cannot exceed the order subtotal");
  assert.equal(rule(9000000).usable.length, 20, "large balances never create an unbounded choices array");
  const legacy = C.redeemView({ balance: 12000, tiers: [{ points: 5000, cents: 500 }, { points: 10000, cents: 1000 }] }, 5597);
  assert.deepEqual(legacy.usable.map((x) => x.points), [10000], "pre-0007 compatibility hides the legacy 5,000-point tier");
  assert.equal(C.redeemView(null, 5597).any, false);
  assert.equal(C.redeemView({ balance: 999999, tiers: [{ points: -1, cents: 500 }, { points: 5000, cents: 500 }] }, 5597).any, false, "invalid/legacy tiers are ignored");
});

test("F-OWN-4: 0006 keeps points server-side (grants, members only, debit on payment)", () => {
  const sql = readFileSync(new URL("../supabase/migrations/0006_points_redeem.sql", import.meta.url), "utf8");
  assert.match(sql, /revoke all on function public\.azal_points_balance\(uuid\) from public, anon, authenticated;/);
  assert.match(sql, /revoke all on function public\.redeem_options\(\) from public, anon;\s*grant execute on function public\.redeem_options\(\) to authenticated;/);
  assert.match(sql, /raise exception 'redeem_members_only'/);
  assert.match(sql, /'redeem:' \|\| v_o\.id, 'redeem', -v_o\.redeemed_points/);
  assert.match(sql, /pg_advisory_xact_lock\(pg_catalog\.hashtext\('points\|' \|\| v_o\.user_id::text\)\)/);
  assert.match(sql, /\('redeem_tiers', '5000:500,10000:1000'\) on conflict \(key\) do nothing/);
});

test("0007 is forward-only and pins the server redemption invariant", () => {
  const m6 = readFileSync(new URL("../supabase/migrations/0006_points_redeem.sql", import.meta.url), "utf8");
  const m7 = readFileSync(new URL("../supabase/migrations/0007_points_increments.sql", import.meta.url), "utf8");
  assert.match(m6, /\('redeem_tiers', '5000:500,10000:1000'\) on conflict \(key\) do nothing/, "0006 stays immutable historical source");
  assert.match(m7, /p_points > 0/);
  assert.match(m7, /p_points % 10000 = 0/);
  assert.match(m7, /then p_points \/ 10/);
  assert.match(m7, /'step_points', 10000/);
  assert.match(m7, /'cents_per_step', 1000/);
  assert.match(m7, /'max_steps', 20/);
  assert.doesNotMatch(m7, /on conflict/i);
  assert.match(m7, /invalid_redeem_config/);
  assert.match(m7, /revoke all on function public\.azal_redeem_cents\(integer\) from public, anon, authenticated/);
});
