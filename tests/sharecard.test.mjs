import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const C = require("../sharecard.js");
const names = { 1: "Lamb Mandi", 6: "Sahawiq & Fresh Bread" };

test("card lines come from the cart only; quantities summed; more than 9 dishes folds into '+N'", () => {
  const r = C.cardLines(new Map([[1, 2], [6, 1], [99, 3]]), (id) => (names[id] ? { name: names[id] } : null), "en");
  assert.deepEqual(r.shown, [{ qty: 2, name: "Lamb Mandi" }, { qty: 1, name: "Sahawiq & Fresh Bread" }]);
  assert.equal(r.count, 3);
  const many = C.cardLines(new Map(Array.from({ length: 12 }, (_, i) => [i + 1, 1])), (id) => ({ name: "D" + id }), "en");
  assert.equal(many.shown.length, 9); assert.equal(many.more, 3);
});

test("nothing is sent anywhere: no fetch/XHR/beacon in the module; no innerHTML", () => {
  const src = readFileSync(new URL("../sharecard.js", import.meta.url), "utf8");
  assert.doesNotMatch(src, /fetch\(|XMLHttpRequest|sendBeacon|innerHTML/);
});

test("long dish names wrap to a second line instead of being squeezed (EN/FR/AR)", () => {
  const m = (t) => t.length * 10; // 10px per character
  assert.deepEqual(C.wrapName("Mandi", 100, m), ["Mandi"]);
  assert.deepEqual(C.wrapName("Agneau mandi lentement fumé du Hadramaout", 200, m), ["Agneau mandi", "lentement fumé du Hadramaout"]);
  assert.deepEqual(C.wrapName("مندي لحم ضأن مدخّن على الطريقة الحضرمية", 200, m), ["مندي لحم ضأن مدخّن", "على الطريقة الحضرمية"]);
  assert.deepEqual(C.wrapName("Supercalifragilistic", 100, m), ["Supercalifragilistic"], "one long word stays whole");
});
test("every language says the tray is a draft, not ordered (ChatGPT #44: FR lacked it)", () => {
  const src = readFileSync(new URL("../sharecard.js", import.meta.url), "utf8");
  assert.ok(src.includes("not ordered yet") && src.includes("pas encore commandé") && src.includes("لم تُطلب بعد"));
});
