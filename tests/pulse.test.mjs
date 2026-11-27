import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const P = require("../pulse.js");
const keys = (s) => P.timeline(s).map((x) => x.key + ":" + x.state).join(" ");

test("milestones follow only the persisted status; Preparing appears only when the server says preparing", () => {
  assert.equal(keys("placed"), "placed:current accepted:todo ready:todo handed_over:todo");
  assert.equal(keys("accepted"), "placed:done accepted:current ready:todo handed_over:todo");
  assert.equal(keys("preparing"), "placed:done accepted:done preparing:current ready:todo handed_over:todo");
  assert.equal(keys("ready"), "placed:done accepted:done ready:current handed_over:todo");
  assert.equal(keys("handed_over"), "placed:done accepted:done ready:done handed_over:done");
  assert.equal(keys("cancelled"), "cancelled:current");
});

test("unknown status is not guessed", () => {
  assert.equal(P.timeline("almost_ready"), null);
  assert.equal(P.timeline(undefined), null);
});

test("reads only the member's own PAID order (explicit user_id); no guest path; no ETA words in the module", async () => {
  const urls = [];
  const p = P.createPulse({ config: { url: "https://x.supabase.co", anonKey: "a" }, getSession: async () => ({ access_token: "T", user: { id: "u1" } }), fetch: async (u) => { urls.push(decodeURIComponent(u)); return { ok: true, json: async () => [] }; } });
  await p.active(); await p.byId("o-1");
  assert.match(urls[0], /\/rest\/v1\/orders\?select=id,fulfilment_status,payment_status,pickup_slot&user_id=eq\.u1&payment_status=eq\.paid&fulfilment_status=not\.in\.\(handed_over,cancelled\)/);
  assert.match(urls[1], /&user_id=eq\.u1&id=eq\.o-1&limit=1$/);
  await assert.rejects(P.createPulse({ config: { url: "https://x.supabase.co", anonKey: "a" }, getSession: async () => null, fetch: async () => ({}) }).active(), { code: "signed_out" });
  const src = readFileSync(new URL("../pulse.js", import.meta.url), "utf8");
  assert.doesNotMatch(src.slice(src.indexOf("const S = {"), src.indexOf("const lang =")), /\bminutes?\b|\bmin\b|ETA|almost ready|%|دقيقة|minute/i, "no time estimate in any copy");
  assert.doesNotMatch(src, /innerHTML/);
});

test("payment no longer paid (refunded/voided) = not an active order", () => {
  assert.equal(P.isClosedPayment({ payment_status: "paid" }), false);
  assert.equal(P.isClosedPayment({ payment_status: "refunded" }), true);
  assert.equal(P.isClosedPayment({ payment_status: "voided" }), true);
});
