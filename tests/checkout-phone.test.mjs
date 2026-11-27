import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const js = readFileSync(new URL("../script.js", import.meta.url), "utf8");
test("F-CHK-1: the checkout panel scrolls inside itself at phone heights; × and the button are pinned", () => {
  assert.match(css, /\.checkout-panel\{max-height:calc\(100dvh - 24px\);overflow-y:auto/);
  assert.match(css, /\.checkout-panel \.modal-close\{position:sticky;top:0/);
  assert.match(css, /\.checkout-panel #placeDemoOrder\{position:sticky;bottom:0/);
});
test("F-CHK-2: HST 13% with the server's half-up cents arithmetic (0004 place_order)", () => {
  assert.match(js, /const HST_BPS=1300;/);
  assert.match(js, /Math\.floor\(\(sub\*HST_BPS\+5000\)\/10000\)/);
  const tr = js.slice(js.indexOf("const translations"), js.indexOf("const productTranslations"));
  for (const k of ['hst:"HST (13%)"', 'hst:"TVH (13 %)"', 'hst:"ضريبة المبيعات (13%)"', 'total:"Total"', 'total:"المجموع"']) assert.ok(tr.includes(k), k);
  for (const p of ["index", "menu", "story", "member", "404"]) { // reserve.html is table-only, no checkout
    const h = readFileSync(new URL(`../${p}.html`, import.meta.url), "utf8");
    assert.ok(h.includes('id="cartTax"') && h.includes('id="cartGrand"') && h.includes('id="checkoutTotals"'), p + " has the HST and total lines");
  }
});
