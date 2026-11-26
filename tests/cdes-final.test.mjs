// C-DES v3 final (Claude, ruled 00:52): calm Menu, one type scale, placed links.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const menu = read("menu.html"), home = read("index.html"), css = read("styles.css"), js = read("script.js");

test("1: mood guide is collapsed (kept, not removed) and sits after the tabs", () => {
  assert.match(menu, /<details class="sufra-section sufra-collapsible" id="sufra-guide"><summary><span data-i18n="sufraSummary">/);
  assert.ok(!/<details class="sufra-section[^>]*\bopen\b/.test(menu));
  assert.ok(menu.indexOf('id="categoryTabs"') < menu.indexOf('id="sufra-guide"'));
  assert.ok(menu.indexOf('id="sufra-guide"') < menu.indexOf('id="productGrid"'));
  for (const k of ["sufraRiceCopy", "sufraWarmCopy", "sufraSidesCopy"]) assert.match(menu, new RegExp(`data-i18n-title="${k}"`));
  assert.match(js, /querySelectorAll\("\[data-i18n-title\]"\)/);
});

test("2: menu body type tiers are 12/14/16 with one display step for dish names", () => {
  assert.match(css, /\.menu-section \.product-info h3\{font-size:21px\}/);
  assert.match(css, /\.menu-section \.menu-intro\{font-size:16px\}/);
});

test("3: demo badge sits directly under the intro", () => {
  assert.match(menu, /<p class="menu-intro"[^>]*>[^<]*<\/p><\/div><span class="demo-label" data-i18n="demoLabel">/);
  assert.match(css, /\.menu-top\{display:block\}/);
});

test("4: 'Read our story' lives inside The idea", () => {
  assert.match(home, /<div class="welcome-copy"><p data-i18n="storyText">[^<]*<\/p><div class="story-teaser-link"><a class="text-link dark-link" href="story\.html"/);
});

test("5: Visit is one column while the card is hidden", () => {
  assert.match(css, /\.visit:has\(\.visit-card\[hidden\]\)\{grid-template-columns:1fr\}/);
});
