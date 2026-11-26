import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const R = require("../reserve.js");
const CFG = { url: "https://x.supabase.co", anonKey: "anon" };
const ok = (data) => async () => ({ ok: true, json: async () => data });

test("phone normalisation matches the server rule", () => {
  assert.equal(R.normalizePhone("(343) 555-0101"), "+13435550101");
  assert.equal(R.normalizePhone("1 343 555 0101"), "+13435550101");
  assert.equal(R.normalizePhone("+44 20 7946 0958"), "+442079460958");
  for (const bad of ["", "555-0101", "44 20 7946 0958 12345 6", "abc"]) assert.equal(R.normalizePhone(bad), null, bad);
});

test("table-only: the request carries exactly the six owner fields + key, nothing about food or payment", async () => {
  const calls = [];
  const r = R.createReservations({ config: CFG, fetch: async (u, o) => { calls.push([u, JSON.parse(o.body)]); return { ok: true, json: async () => ({ code: "ABCDEFGH" }) }; } });
  await r.reserve({ party: 4, startsAt: "2026-11-28T00:00:00.000Z", name: " Sara ", email: " Sara@Example.com ", phone: "343 555 0101" });
  assert.equal(calls[0][0], "https://x.supabase.co/rest/v1/rpc/reserve_table");
  assert.deepEqual(Object.keys(calls[0][1]).sort(), ["p_branch", "p_email", "p_idempotency_key", "p_name", "p_party", "p_phone", "p_starts_at"]);
  assert.equal(calls[0][1].p_phone, "+13435550101");
  assert.equal(calls[0][1].p_email, "sara@example.com");
  assert.doesNotMatch(JSON.stringify(calls[0][1]), /note|item|order|pay|card|deposit|menu/i);
});

test("invalid input sends nothing", async () => {
  const calls = [];
  const r = R.createReservations({ config: CFG, fetch: async (...a) => { calls.push(a); return { ok: true, json: async () => ({}) }; } });
  const good = { party: 2, startsAt: "2026-11-28T00:00:00Z", name: "A", email: "a@b.co", phone: "3435550101" };
  for (const [k, v, code] of [["phone", "", "invalid_phone"], ["email", "x", "invalid_email"], ["email", "<svg/onload=alert(1)>@example.com", "invalid_email"], ["email", "a\"b@example.com", "invalid_email"], ["name", " ", "invalid_name"], ["party", 11, "invalid_party"], ["startsAt", null, "invalid_time"]])
    await assert.rejects(r.reserve({ ...good, [k]: v }), { code });
  assert.equal(calls.length, 0);
});

test("retry after a network error reuses the key; a changed request or a new booking gets a new key", async () => {
  const keys = []; let fail = true;
  const r = R.createReservations({ config: CFG, fetch: async (u, o) => { keys.push(JSON.parse(o.body).p_idempotency_key); if (fail) { fail = false; throw new Error("offline"); } return { ok: true, json: async () => ({ code: "ABCDEFGH" }) }; } });
  const f = { party: 2, startsAt: "2026-11-28T00:00:00Z", name: "A", email: "a@b.co", phone: "3435550101" };
  await assert.rejects(r.reserve(f), { code: "network" });
  await r.reserve(f);
  await r.reserve(f);
  assert.equal(keys[0], keys[1]);
  assert.notEqual(keys[1], keys[2]);
});

test("cancel: a 'not_found' or 'too_late' status from the server becomes an error code", async () => {
  const r = R.createReservations({ config: CFG, fetch: async () => ({ ok: true, json: async () => ({ status: "not_found" }) }) });
  await assert.rejects(r.cancel("ZZZZZZZZ", "a@b.co"), { code: "not_found" });
});

test("no innerHTML with dynamic values in the confirmation or time slots", () => {
  const src = readFileSync(new URL("../reserve.js", import.meta.url), "utf8");
  assert.doesNotMatch(src, /done\.innerHTML|rsSlots"\)\.innerHTML/);
  assert.match(src, /done\.replaceChildren\(/);
});

test("availability and cancel call the 0005 functions; inert without config", async () => {
  const calls = [];
  const r = R.createReservations({ config: CFG, fetch: async (u, o) => { calls.push([u.split("/rpc/")[1], JSON.parse(o.body)]); return { ok: true, json: async () => [] }; } });
  await r.availability("2026-11-28", 3); await r.cancel(" abcdefgh ", " a@b.co ");
  assert.deepEqual(calls, [["reservation_availability", { p_branch: "ottawa", p_day: "2026-11-28", p_party: 3 }], ["cancel_reservation", { p_code: "abcdefgh", p_email: "a@b.co" }]]);
  assert.equal(R.createReservations({ config: { url: null, anonKey: null }, fetch: async () => {} }).enabled, false);
});

test("Toronto dates for the date picker bounds", () => {
  assert.equal(R.torontoDate(Date.parse("2026-11-27T04:30:00Z"), 0), "2026-11-26"); // 23:30 Toronto
  assert.equal(R.torontoDate(Date.parse("2026-11-27T04:30:00Z"), 30), "2026-12-26");
});

test("reserve page loads reserve.js with the release version; copy asks for mobile", () => {
  const h = readFileSync(new URL("../reserve.html", import.meta.url), "utf8");
  const v = h.match(/script\.js\?v=([\w-]+)"/)[1];
  assert.ok(h.indexOf(`auth.js?v=${v}`) < h.indexOf(`reserve.js?v=${v}`));
  assert.match(readFileSync(new URL("../script.js", import.meta.url), "utf8"), /reserveHow2:"Leave your name, mobile number and email\. Nothing else\."/);
});

test("booking has its own go-live gate: shared Supabase config alone is not enough", () => {
  const sb = { url: "https://x.supabase.co", anonKey: "anon" };
  assert.equal(R.bookingLive({ bookingEnabled: true, goLiveAuthorized: true }, sb), true);
  assert.equal(R.bookingLive({ bookingEnabled: false, goLiveAuthorized: true }, sb), false);
  assert.equal(R.bookingLive({ bookingEnabled: true, goLiveAuthorized: false }, sb), false);
  assert.equal(R.bookingLive({ bookingEnabled: "true", goLiveAuthorized: true }, sb), false);
  assert.equal(R.bookingLive({ bookingEnabled: true, goLiveAuthorized: true }, { url: null, anonKey: null }), false);
  const cfg = readFileSync(new URL("../reservation-config.js", import.meta.url), "utf8");
  assert.match(cfg, /bookingEnabled: false,/);
  assert.match(cfg, /goLiveAuthorized: false/);
});
