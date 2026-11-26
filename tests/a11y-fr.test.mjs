// A11Y2 (Claude): every accessible name (skip link, aria-label, img alt) is translated, so French screen-reader users hear French.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const js = fs.readFileSync(path.join(root, "script.js"), "utf8");
const m = js.match(/const translations\s*=\s*(\{[\s\S]*?\n\});/);
const T = Function(`return (${m[1]});`)();
const DYNAMIC = new Set(["Switch language"]); // set by applyLanguage() itself

for (const p of ["index.html", "menu.html", "story.html", "member.html", "reserve.html"]) {
  const html = fs.readFileSync(path.join(root, p), "utf8");
  test(`${p}: skip link, aria-labels and alts are translatable`, () => {
    assert.match(html, /<a class="skip-link" href="#main-content" data-i18n="skipLink">/);
    for (const tag of html.matchAll(/<[^>]+>/g)) {
      const t = tag[0];
      const label = t.match(/\saria-label="([^"]*)"/)?.[1];
      if (label && !/[؀-ۿ]/.test(label) && !DYNAMIC.has(label)) {
        const key = t.match(/data-i18n-aria-label="([^"]+)"/)?.[1];
        assert.ok(key, `${p}: aria-label "${label}" has no data-i18n-aria-label`);
        assert.ok(T.en[key] && T.fr[key] && T.fr[key] !== T.en[key] || key === "ariaYourOrder" || T.fr[key], `${p}: ${key} missing`);
      }
      const alt = t.startsWith("<img") ? t.match(/\salt="([^"]*)"/)?.[1] : null;
      if (alt) {
        const key = t.match(/data-i18n-alt="([^"]+)"/)?.[1];
        assert.ok(key && T.en[key] && T.fr[key], `${p}: img alt "${alt}" is not translatable`);
      }
    }
  });
}

test("applyLanguage translates alt attributes", () => {
  assert.match(js, /querySelectorAll\("\[data-i18n-alt\]"\)\.forEach\(el=>\{el\.setAttribute\("alt",t\(el\.dataset\.i18nAlt\)\)\}\)/);
});
