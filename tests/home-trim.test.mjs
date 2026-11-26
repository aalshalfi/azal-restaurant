// Home trim (Claude): one menu button, compact signature rows, visit card hidden until owner facts exist.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const home = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const js = fs.readFileSync(path.join(root, "script.js"), "utf8");

test("Home has one 'See the menu' button (hero) plus one text link", () => {
  assert.equal((home.match(/class="button[^"]*"[^>]*href="menu\.html"|href="menu\.html"[^>]*class="button/g) || []).length, 1);
  assert.match(home, /class="text-link dark-link signature-more" href="menu\.html" data-i18n="signatureMore"/);
});

test("visit card stays hidden while facts are 'coming soon'; hours line shown", () => {
  assert.match(home, /<div class="visit-card" hidden data-show-when="owner-facts">/);
  assert.match(home, /<p class="visit-hours"><span data-i18n="hoursLabel">/);
  assert.ok(!/data-i18n="hoursLabel">Hours<\/span><strong data-i18n="toAnnounce"/.test(home), "hours row must not say 'Address coming soon'");
});

test("compact signature rows on mobile", () => {
  assert.match(css, /\.signature-card img\{grid-row:1\/3;width:96px;height:96px\}/);
});

test("live region is cleared on language switch", () => {
  const fn = js.slice(js.indexOf("function applyLanguage(){"), js.indexOf("function applyLanguage(){") + 1500);
  assert.match(fn, /getElementById\("cartStatus"\);if\(liveRegion\)liveRegion\.textContent=""/);
});
