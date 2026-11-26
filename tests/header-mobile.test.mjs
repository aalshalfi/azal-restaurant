import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const pages = ["index", "menu", "member", "reserve", "story", "404"];
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

test("HDR-MOB: every page has the quick language + Majlis controls and a compact cart with an accessible label", () => {
  for (const p of pages) {
    const h = read(`${p}.html`);
    assert.match(h, /<div class="header-quick"><button class="language-quick" type="button" data-lang-quick>FR<\/button><a class="majlis-quick" href="member\.html" aria-label="Majlis" data-i18n-aria-label="navMajlis">/, p);
    assert.match(h, /<button class="cart-open" id="cartOpen"><svg class="hq-icon cart-icon"[^>]*aria-hidden="true"[^>]*>.*?<\/svg><span class="cart-label" data-i18n="cartButton">Your order<\/span> <span id="cartCount">0<\/span><\/button>/, p);
    assert.equal((h.match(/id="languageToggle"/g) || []).length, 1, p + ": desktop toggle kept");
  }
});

test("HDR-MOB: mobile-only CSS; quick controls hidden on desktop; 44px targets", () => {
  const css = read("styles.css");
  const block = css.slice(css.indexOf("/* HDR-MOB"));
  assert.match(block, /^\/\* HDR-MOB[^]*?\.header-quick,\.cart-open \.cart-icon\{display:none\}\n/);
  assert.match(block, /@media\(max-width:800px\)\{[^]*\.site-header\{height:64px/);
  assert.match(block, /\.language-quick,\.majlis-quick\{[^}]*width:44px;height:44px/);
  assert.match(block, /\.cart-open\{position:relative;[^}]*width:44px;height:44px/);
});

test("both language buttons switch language; aria-pressed dropped (lead ruling 07:00)", () => {
  const s = read("script.js");
  assert.match(s, /\[\$\("languageToggle"\),\.\.\.document\.querySelectorAll\("\[data-lang-quick\]"\)\]\.forEach\(b=>b\?\.addEventListener\("click"/);
  assert.match(s, /b\.removeAttribute\("aria-pressed"\)/);
});
