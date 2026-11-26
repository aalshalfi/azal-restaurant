import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "reservations.html"), "utf8");
const pageJs = fs.readFileSync(path.join(root, "reservations.js"), "utf8");

test("reservation preview uses only owner-confirmed booking facts", () => {
  assert.match(html, /60 minutes/);
  assert.match(html, /Up to 50 guests/);
  assert.match(html, /No deposit required/);
  assert.match(html, /11:00–21:00/);
  assert.match(html, /Operating days are not yet confirmed/);
  assert.match(html, /reservation email address has not been provided/i);
});

test("reservation controls are inert and cannot collect or submit personal data", () => {
  const disabledFieldset = html.match(/<fieldset[^>]*disabled[^>]*>([\\s\\S]*?)<\\/fieldset>/i)?.[1] ?? "";\n  assert.ok(disabledFieldset, "all booking controls must be inside a disabled fieldset");\n  assert.equal((disabledFieldset.match(/<(input|select|textarea)\\b/gi) ?? []).length, 7);\n  assert.doesNotMatch(html.replace(disabledFieldset, ""), /<(input|select|textarea)\\b/i);
  assert.doesNotMatch(html, /<form\b|\baction=/i);
  assert.doesNotMatch(html, /\bname=["']/i);
  assert.match(html, /<button[^>]*disabled[^>]*aria-disabled="true"/);
  assert.doesNotMatch(html, /mailto:|supabase|createClient|signUp|signIn/i);
  assert.doesNotMatch(pageJs, /supabase|createClient|fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|mailto:/i);
});

test("reservation preview is bilingual and uses shared P1 v3 language/cart hooks", () => {
  assert.match(html, /data-res-en=/);
  assert.match(html, /data-res-fr=/);
  assert.match(html, /id="languageToggle"/);
  assert.match(html, /id="cartCount"/);
  assert.ok(html.indexOf("script.js") < html.indexOf("reservations.js"));
  assert.match(pageJs, /addEventListener\("click", applyReservationCopy\)/);
});
