import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "member.html"), "utf8");
const memberJs = fs.readFileSync(path.join(root, "member.js"), "utf8");

test("Majlis page is a bilingual preview with no personal-data form", () => {
  assert.match(html, /data-member-en=/);
  assert.match(html, /data-member-fr=/);
  assert.match(html, /Preview only/);
  assert.match(html, /Aperçu seulement/);
  assert.doesNotMatch(html, /<form\b|<input\b|<textarea\b|<select\b/i);
  assert.match(html, /Sign in — not active/);
  assert.match(html, /Join Majlis — not active/);
  assert.match(html, /disabled aria-disabled="true"/);
});

test("Member preview has no auth, network, storage or real-points wiring", () => {
  assert.doesNotMatch(memberJs, /supabase|createClient|signUp|signIn|fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage/i);
  assert.match(html, /Points balance/);
  assert.match(html, /—/);
  assert.match(html, /No real points or orders are active/);
});

test("Member page reuses P1 v3 shared language and cart primitives", () => {
  assert.match(html, /id="languageToggle"/);
  assert.match(html, /id="cartCount"/);
  assert.match(html, /href="menu.html#menu"/);
  assert.ok(html.indexOf("script.js") < html.indexOf("member.js"));
  assert.match(memberJs, /addEventListener\("click", applyMemberCopy\)/);
});
