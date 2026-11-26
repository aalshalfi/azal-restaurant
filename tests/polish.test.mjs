// Pre-checkpoint fixes (Claude, approved 01:54): cache-busting, titles, nav marking, story, 404.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const pages = { "index.html": "navHome", "menu.html": "navMenu", "story.html": "navStory", "member.html": "navMajlis", "reserve.html": "navReserve" };
const all = [...Object.keys(pages), "404.html"];
const js = read("script.js");
const T = Function(`return (${js.match(/const translations\s*=\s*(\{[\s\S]*?\n\});/)[1]});`)();

test("1: one release version on script.js and styles.css across every page", () => {
  const versions = new Set();
  for (const p of all) {
    const h = read(p);
    const s = h.match(/script\.js\?v=([\w-]+)"/)?.[1], c = h.match(/styles\.css\?v=([\w-]+)"/)?.[1];
    assert.ok(s && c, `${p} missing a version`); assert.equal(s, c, `${p} script and styles versions differ`);
    versions.add(s);
  }
  assert.equal(versions.size, 1, `pages carry different versions: ${[...versions]}`);
});
test("2: titles are AZAL-pattern, translated, and switched by applyLanguage", () => {
  for (const p of all) {
    const h = read(p); const key = h.match(/data-title-key="([^"]+)"/)?.[1];
    assert.ok(key && T.en[key] && T.fr[key], `${p} title key`);
    assert.equal(h.match(/<title>([^<]*)<\/title>/)[1], T.en[key]);
    assert.ok(!/A Taste of Yemen|restaurant concept/i.test(h.match(/<head>[\s\S]*<\/head>/)[0]), `${p} old copy in head`);
  }
  assert.match(js, /document\.title=tt/);
});
test("3: each page marks its own nav link and only that one", () => {
  for (const [p, key] of Object.entries(pages)) {
    const h = read(p);
    assert.equal((h.match(/aria-current="page"/g) || []).length, 1, p);
    assert.match(h, new RegExp(`data-i18n="${key}" aria-current="page"`), p);
  }
});
test("4-5: Story no longer repeats Home's 'The idea'; the map block has its kicker", () => {
  const s = read("story.html");
  assert.ok(!/data-i18n="storyText"/.test(s));
  assert.match(s, /<div class="section-kicker" data-i18n="storyMapKicker">/);
});
test("8: 404 page works from any depth and offers menu + home", () => {
  const h = read("404.html");
  assert.match(h, /<base href="\/azal-restaurant\/">/);
  assert.match(h, /href="menu\.html" data-i18n="heroMenu"/);
  assert.match(h, /href="index\.html" data-i18n="navHome"/);
});
