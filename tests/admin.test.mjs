// ADM-1 pure helpers + static guards. Run: node --test tests/admin.test.mjs
import test from "node:test"; import assert from "node:assert/strict"; import { readFileSync } from "node:fs"; import { createRequire } from "node:module";
const require = createRequire(import.meta.url); const A = require("../admin.js"); const R = require("../role-door.js");
const read = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");

test("overview counts: unpaid and cancelled never count as kitchen work; sales = collected totals", () => {
  const s = A.summarise([
    { branch_slug: "ottawa", fulfilment_status: "placed", payment_status: "paid", total_cents: 1000 },
    { branch_slug: "ottawa", fulfilment_status: "placed", payment_status: "unpaid", total_cents: 900 },
    { branch_slug: "ottawa", fulfilment_status: "preparing", payment_status: "paid", total_cents: 800 },
    { branch_slug: "second", fulfilment_status: "ready", payment_status: "paid", total_cents: 700 },
    { branch_slug: "second", fulfilment_status: "handed_over", payment_status: "paid", total_cents: 2259 },
    { branch_slug: "second", fulfilment_status: "cancelled", payment_status: "refunded", total_cents: 500 }]);
  assert.deepEqual([s.newPaid, s.inKitchen, s.ready, s.collected, s.cancelled, s.unpaid, s.salesCents], [1, 1, 1, 1, 1, 1, 2259]);
  assert.deepEqual(s.byBranch, { ottawa: { orders: 3, collected: 0 }, second: { orders: 3, collected: 1 } });
});

test("today starts at Toronto midnight in winter and summer", () => {
  assert.equal(A.torontoMidnight(Date.parse("2026-11-27T18:00:00Z")), "2026-11-27T05:00:00.000Z");
  assert.equal(A.torontoMidnight(Date.parse("2026-07-01T03:30:00Z")), "2026-06-30T04:00:00.000Z", "23:30 EDT still belongs to June 30");
});

test("role comes from the server: azal_is_admin() first, then the caller's own user_roles", async () => {
  const fake = (admin, roles) => async (url) => ({ ok: true, json: async () => (url.includes("azal_is_admin") ? admin : roles) });
  const base = { config: { url: "https://x.supabase.co", anonKey: "a" }, session: { access_token: "T", user: { id: "u1" } } };
  assert.equal(await R.roleOf({ ...base, fetch: fake(true, []) }), "admin");
  assert.equal(await R.roleOf({ ...base, fetch: fake(false, [{ role: "staff" }]) }), "staff");
  assert.equal(await R.roleOf({ ...base, fetch: fake(false, [{ role: "manager" }]) }), "manager");
  assert.equal(await R.roleOf({ ...base, fetch: fake(false, [{ role: "customer" }]) }), "customer");
  assert.equal(await R.roleOf({ ...base, fetch: async () => ({ ok: false, json: async () => null }) }), "customer", "a failed check never grants anything");
  assert.equal(await R.roleOf({ ...base, session: null, fetch: fake(true, []) }), "none");
});

test("admin page: noindex, not linked from the public nav, renders with textContent only, writes nothing", () => {
  const h = read("admin.html"), js = read("admin.js");
  assert.match(h, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(h, /auth\.js\?v=([\w-]+)" defer><\/script><script src="admin\.js\?v=\1" defer>/);
  for (const p of ["index", "menu", "member", "reserve", "story", "404"]) assert.doesNotMatch(read(p + ".html"), /href="admin\.html"/, p);
  assert.doesNotMatch(js, /innerHTML/);
  assert.doesNotMatch(js, /method: "(PATCH|DELETE|PUT)"/);
  assert.doesNotMatch(read("role-door.js"), /innerHTML/);
  assert.match(read("member.html"), /auth\.js\?v=([\w-]+)" defer><\/script><script src="role-door\.js\?v=\1" defer>/);
});

test("#62 review: staff/admin are sent to their own area; the customer view is hidden first; no way back to it", () => {
  const rd = read("role-door.js");
  assert.match(rd, /classList\.add\("role-leaving"\);\s*try \{ root\.location\.replace\(r === "admin" \? "admin\.html" : "staff\.html"\)/);
  // The only way back to member.html is the user's own Sign out (T-01): never an automatic redirect (no loop).
  for (const f of ["admin.js", "staff.js"]) { const src = read(f); for (const m of src.matchAll(/location\.(replace|assign|href\s*=)[^;]*member\.html/g)) assert.match(src.slice(Math.max(0, m.index - 400), m.index), /auth\.signOut\(\)/, f + ": a redirect to member.html outside sign-out"); }
});
