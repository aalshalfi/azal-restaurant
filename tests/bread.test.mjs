import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const B = require("../bread.js");
const script = readFileSync(new URL("../script.js", import.meta.url), "utf8");

test("bread steps appear only on dishes our own menu says are eaten with bread", () => {
  assert.deepEqual(B.BREAD_DISHES, [4, 5, 6]);
  for (const id of B.BREAD_DISHES) {
    const line = script.match(new RegExp(`\\{id:${id},[^\\n]*`))[0];
    assert.match(line, /bread/i, `dish ${id} must mention bread in its own copy`);
  }
});

test("menu loads bread.js after script.js; no innerHTML; reduced motion respected", () => {
  const h = readFileSync(new URL("../menu.html", import.meta.url), "utf8");
  const v = h.match(/script\.js\?v=([\w-]+)"/)[1];
  assert.ok(h.indexOf(`script.js?v=${v}`) < h.indexOf(`bread.js?v=${v}`));
  assert.doesNotMatch(readFileSync(new URL("../bread.js", import.meta.url), "utf8"), /innerHTML/);
  assert.match(readFileSync(new URL("../styles.css", import.meta.url), "utf8"), /@media\(prefers-reduced-motion:reduce\)\{\.bread-step\{animation:none\}\}/);
});

test("V6′ (owner fact 21:03): gesture only, no heat, oven or pickup promise in any language", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../bread.js", import.meta.url), "utf8");
  const copy = src.slice(src.indexOf("en: {"), src.indexOf("}", src.indexOf("ar: {")) + 1);
  for (const w of [/hot/i, /warm/i, /oven/i, /pickup/i, /chaud/i, /four\b/i, /retrait/i, /ساخن/, /فرن/, /تنور/, /الاستلام/]) assert.doesNotMatch(copy, w);
});
