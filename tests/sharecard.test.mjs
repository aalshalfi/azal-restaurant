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

test("v2 tray link: encode/parse round trip; strict allow-list; retired dishes disclosed, not dropped silently", () => {
  const known = (id) => [1, 2, 3, 4, 5, 6, 7, 8, 9].includes(id);
  const code = C.encodeTray([[1, 2], [6, 1], [8, 2]]);
  assert.equal(code, "v1.1x2.6x1.8x2");
  assert.deepEqual(C.parseTray("#tray=" + code, known), { ok: true, lines: [{ id: 1, qty: 2 }, { id: 6, qty: 1 }, { id: 8, qty: 2 }], retired: 0 });
  assert.equal(C.parseTray("#menu", known), null, "other fragments are not trays");
  for (const bad of ["#tray=", "#tray=v2.1x1", "#tray=v1.1x0", "#tray=v1.1x21", "#tray=v1.1x2.<script>", "#tray=v1.-1x2", "#tray=v1.1x2." , "#tray=v1." + Array(13).fill("1x1").join("."), "#tray=v1.1x1" + ".1x1".repeat(60)])
    assert.deepEqual(C.parseTray(bad, known), { ok: false }, bad.slice(0, 30));
  assert.deepEqual(C.parseTray("#tray=v1.1x2.999x1", known), { ok: true, lines: [{ id: 1, qty: 2 }], retired: 1 });
  assert.deepEqual(C.parseTray("#tray=v1.1x15.1x15", known).lines, [{ id: 1, qty: 20 }], "duplicates merge, capped at 20");
  assert.equal(C.encodeTray([[1, 99]]), "v1.1x20", "encode caps quantity too");
  assert.equal(C.encodeTray([]), "");
});
