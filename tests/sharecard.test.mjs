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
