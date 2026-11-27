// Browser suites must never reach the real Supabase project now that supabase-config.js is live (3251974):
// each one wraps the browser in nullConfig() or routes supabase-config.js to its own fake config (ChatGPT, #40 review).
import test from "node:test"; import assert from "node:assert/strict"; import { readFileSync, readdirSync } from "node:fs";
test("every browser suite stubs supabase-config.js", () => {
  const dir = new URL("./", import.meta.url); const suites = readdirSync(dir).filter((f) => f.endsWith(".browser.mjs"));
  assert.ok(suites.length >= 10);
  for (const f of suites) { const s = readFileSync(new URL(f, dir), "utf8");
    const wrapped = /nullConfig\(await chromium\.launch\(\)\)/.test(s); const ownRoute = /route\("\*\*\/supabase-config\.js\*"/.test(s);
    assert.ok(wrapped || ownRoute, `${f} loads the shipped (live) config`); }
});
