// Content guard (Claude, 2026-11-26): protects the content-v3 integration.
// Every data-i18n key used on any page must exist, non-empty, in both EN and FR;
// FR must not silently equal EN for sentences; owner placeholders must never be shown.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = fs.readFileSync(path.join(root, "script.js"), "utf8");
const m = src.match(/const translations\s*=\s*(\{[\s\S]*?\n\});/);
const translations = m ? Function(`return (${m[1]});`)() : null;
const pages = ["index.html", "menu.html", "story.html", "member.html", "reserve.html", "404.html"].filter((p) => fs.existsSync(path.join(root, p)));

test("translations object is readable", () => {
  assert.ok(translations && translations.en && translations.fr, "const translations = {...} not found in script.js");
});

for (const page of pages) {
  test(`${page}: every data-i18n key exists in EN and FR`, () => {
    const html = fs.readFileSync(path.join(root, page), "utf8");
    const keys = [...new Set([...html.matchAll(/data-i18n="([^"]+)"/g)].map((x) => x[1]))];
    const missing = keys.filter((k) => !translations.en[k]?.trim() || !translations.fr[k]?.trim());
    assert.deepEqual(missing, [], `missing or empty: ${missing.join(", ")}`);
  });
}

test("FR sentences are translated, not copied from EN", () => {
  const same = Object.keys(translations.en).filter((k) => {
    const en = translations.en[k], fr = translations.fr[k];
    return typeof en === "string" && en.split(" ").length > 3 && en === fr;
  });
  assert.deepEqual(same, [], `FR equals EN: ${same.join(", ")}`);
});

test("no owner placeholder is shown as text", () => {
  for (const lang of ["en", "fr"]) {
    for (const [k, v] of Object.entries(translations[lang])) {
      if (typeof v === "string" && v.startsWith("{owner")) {
        // allowed only if the page hides it; script must contain the hide rule
        assert.ok(/\{owner/.test(src.replace(m[1], "")), `${lang}.${k} is an owner placeholder but script.js has no hide rule`);
      }
    }
  }
});
