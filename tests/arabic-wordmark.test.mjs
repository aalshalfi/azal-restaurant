// A1 (Claude): the Arabic wordmark must not depend on a device font.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pages = ["index.html", "menu.html", "story.html", "member.html"];

test("no Arabic text node depends on a system font (only inside aria-label of the outlined SVG)", () => {
  for (const p of pages) {
    const html = fs.readFileSync(path.join(root, p), "utf8").replace(/aria-label="[^"]*"/g, "");
    assert.ok(!/[؀-ۿ]/.test(html), `${p} contains raw Arabic text`);
  }
});

test("wordmark SVG is accessible and uses currentColor", () => {
  const home = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(home, /<svg class="wordmark-ar" focusable="false"[^>]*role="img" aria-label="أَزَال" lang="ar">/);
  assert.match(home, /<path fill="currentColor" d="M/);
});

test("Amiri source and OFL licence are kept in the repo", () => {
  assert.ok(fs.existsSync(path.join(root, "assets/fonts/src/amiri/OFL.txt")));
});
