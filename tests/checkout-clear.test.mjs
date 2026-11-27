// D1 + D2 (Muse, live QA 01:15-01:32): the checkout preview result must not go stale,
// and the dish buttons must reset when the preview clears the cart.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const js = fs.readFileSync(path.join(root, "script.js"), "utf8");

test("D1: stale preview result is cleared when the checkout modal opens", () => {
  const open = js.match(/checkoutButton\?\.\s*addEventListener\("click",\(\)=>\{if\(checkoutModal\)\{[^}]*\}\}\);/);
  assert.ok(open, "checkout open handler not found");
  assert.match(open[0], /checkoutMessage\)checkoutMessage\.textContent=""/);
});

test("D1: stale preview result is cleared on language switch", () => {
  const fn = js.match(/function applyLanguage\(\)\{[\s\S]*?\n\}/);
  assert.ok(fn, "applyLanguage not found");
  assert.match(fn[0], /if\(checkoutMessage\)checkoutMessage\.textContent=""/);
});

test("F-WALK-1 (lead 22:05, supersedes D2): the preview never empties the cart; it still re-renders", () => {
  const handler = js.match(/\$\("placeDemoOrder"\)\?\.\s*addEventListener\("click",\(\)=>\{[\s\S]*?\}\);/);
  assert.ok(handler, "placeDemoOrder handler not found");
  assert.doesNotMatch(handler[0], /cart\.clear\(\)/);
  assert.match(handler[0], /renderCart\(\)/);
  assert.match(handler[0], /renderProducts\(active\?\.dataset\.category\|\|"All",search\?\.value\|\|""\)/);
});
