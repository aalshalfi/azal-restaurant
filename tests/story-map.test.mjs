import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const M = require("../story-map.js");
const script = readFileSync(new URL("../script.js", import.meta.url), "utf8");

test("every region claim comes from the menu's own story lines (no new facts)", () => {
  const story = (id) => script.match(new RegExp(`\\{id:${id},[^\\n]*?story:"([^"]*)"`))[1];
  assert.match(story(1), /Hadramaut/);
  assert.match(script, /stone-pot stews in the highlands around Sana’a/);
  assert.match(story(5), /national dish/);
  assert.match(story(8), /Aden/);
  assert.match(story(9), /Tihama/);
  assert.deepEqual(M.REGIONS.map((r) => r.id), ["hadramaut", "sanaa", "aden", "tihama"]);
});

test("projection keeps every point inside the 560x300 box", () => {
  for (const p of [...M.OUTLINE, ...M.REGIONS.map((r) => r.at)]) {
    const [x, y] = M.project(p);
    assert.ok(x >= 0 && x <= 560 && y >= 0 && y <= 300, String(p));
  }
});

test("story page loads story-map.js after script.js; renders with DOM, not innerHTML", () => {
  const h = readFileSync(new URL("../story.html", import.meta.url), "utf8");
  const v = h.match(/script\.js\?v=([\w-]+)"/)[1];
  assert.ok(h.indexOf(`script.js?v=${v}`) < h.indexOf(`story-map.js?v=${v}`));
  assert.doesNotMatch(readFileSync(new URL("../story-map.js", import.meta.url), "utf8"), /innerHTML/);
});
