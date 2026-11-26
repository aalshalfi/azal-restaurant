import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../script.js", import.meta.url), "utf8");
const tr = eval("(" + src.slice(src.indexOf("{", src.indexOf("const translations")), src.indexOf("const productTranslations")).trim().replace(/;\s*$/, "") + ")");
const prAr = eval("(" + src.slice(src.indexOf("{", src.indexOf("const productTranslationsAr")), src.indexOf("};", src.indexOf("const productTranslationsAr")) + 1) + ")");

test("Arabic covers every English key, keeps every {placeholder}, and is actually Arabic", () => {
  for (const [k, v] of Object.entries(tr.en)) {
    assert.ok(k in tr.ar, "missing ar key: " + k);
    for (const ph of v.match(/\{\w+\}/g) || []) assert.ok(tr.ar[k].includes(ph), `${k}: lost ${ph}`);
    if (/[A-Za-z]{3}/.test(v) && !["memberPointsValue"].includes(k)) assert.match(tr.ar[k], /[؀-ۿ]/, k + " is not Arabic");
  }
});

test("all 9 dishes have Arabic name, description, story; no invented facts beyond EN (same tag presence)", () => {
  const products = eval(src.slice(src.indexOf("[", src.indexOf("const products = [")), src.indexOf("];", src.indexOf("const products = [")) + 1));
  for (const p of products) {
    const a = prAr[p.id];
    assert.ok(a && a.name && a.description && a.story, "dish " + p.id);
    assert.match(a.name, /[؀-ۿ]/);
    assert.equal(Boolean(a.tag), Boolean(p.tag), "dish " + p.id + ": a tag appears only where English has one");
  }
});

test("RTL, Latin digits for prices and times, three-way switch", () => {
  assert.match(src, /document\.documentElement\.dir=language==="ar"\?"rtl":"ltr"/);
  assert.match(src, /ar:"ar-CA-u-nu-latn"/);
  assert.match(src, /NEXT_LANG=\{en:"fr",fr:"ar",ar:"en"\}/);
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /html\[lang="ar"\] \*\{letter-spacing:0!important\}/, "letter-spacing would break Arabic joining");
});

test("Arabic never says 'ideal' (مثالي) where English says 'example'", () => {
  assert.doesNotMatch(src, /مثالي/);
});


test("F-A: Arabic webfont bundled (Amiri, OFL), only for Arabic code points, first in the Arabic stack", () => {
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /@font-face\{font-family:"AZAL Arabic";src:url\("assets\/fonts\/Amiri-Arabic\.woff"\) format\("woff"\);[^}]*unicode-range:U\+0600-06FF/);
  assert.match(css, /html\[lang="ar"\] body,[^{]*\{font-family:"AZAL Arabic"/);
  assert.ok(readFileSync(new URL("../assets/fonts/Amiri-Arabic.woff", import.meta.url)).length > 50000);
  assert.match(readFileSync(new URL("../assets/fonts/OFL-Amiri.txt", import.meta.url), "utf8"), /SIL OPEN FONT LICENSE/i);
});
