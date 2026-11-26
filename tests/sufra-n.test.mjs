// Sufra for N prototype (Claude): spread logic, markup and translations.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = fs.readFileSync(path.join(root, "script.js"), "utf8");
const menu = fs.readFileSync(path.join(root, "menu.html"), "utf8");
const fn = src.match(/function sufraSpread\(n\)\{[\s\S]*?\n\}/);
const sufraSpread = Function(`${fn[0]}; return sufraSpread;`)();
const productIds = new Set([...src.matchAll(/\{id:(\d+),/g)].map((m) => Number(m[1])));

for (const n of [2, 4, 6, 8]) {
  test(`SFN spread for ${n} guests is complete and valid`, () => {
    const lines = sufraSpread(n);
    const qty = (id) => lines.find((l) => l.id === id)?.qty || 0;
    for (const l of lines) {
      assert.ok(productIds.has(l.id), `unknown dish id ${l.id}`);
      assert.ok(Number.isInteger(l.qty) && l.qty > 0, `bad qty for ${l.id}`);
    }
    assert.equal(qty(1) + qty(2), Math.ceil(n / 2), "one rice platter per two guests");
    assert.equal(qty(8), n, "one chai per guest");
    assert.ok(qty(5) >= 1, "at least one stew");
    assert.equal(qty(6), Math.ceil(n / 2), "bread and sahawiq per two guests");
    assert.ok(lines.length >= 5 && lines.length <= 7, "a full spread, not the whole menu");
  });
}

test("SFN clamps nonsense input", () => {
  assert.ok(sufraSpread(0).length > 0);
  assert.ok(sufraSpread(999).find((l) => l.id === 8).qty <= 12);
});

test("SFN card is collapsed by default, accessible, above the dish list", () => {
  assert.match(menu, /<details class="sufra-n" id="sufraN">/);
  assert.ok(!/<details class="sufra-n"[^>]*\bopen\b/.test(menu), "card must start collapsed (calm Menu page)");
  assert.ok(menu.indexOf('id="sufraN"') < menu.indexOf('id="productGrid"'));
  for (const n of [2, 4, 6, 8]) assert.match(menu, new RegExp(`data-sfn-size="${n}" aria-pressed="false"`));
  assert.match(menu, /role="group" aria-labelledby="sfnGroupLabel"/);
});

test("SFN shows the illustrative note and never sends or charges", () => {
  assert.match(menu, /data-i18n="sfnNote"/);
  const block = src.slice(src.indexOf("function sufraSpread"));
  assert.ok(!/fetch\(|XMLHttpRequest|supabase/i.test(block), "prototype must not call any network");
});
