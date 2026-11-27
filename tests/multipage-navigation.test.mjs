import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pages = ["index.html", "menu.html", "story.html", "member.html"].map((name) => ({
  name,
  html: fs.readFileSync(path.join(root, name), "utf8"),
}));
const script = fs.readFileSync(path.join(root, "script.js"), "utf8");

test("all four pages share navigation, language, cart and demo checkout", () => {
  for (const { name, html } of pages) {
    assert.ok(html.includes('href="index.html"') && html.includes('href="menu.html"') && html.includes('href="story.html"') && html.includes('href="member.html"'), name + " missing shared page navigation");
    assert.ok(html.includes('id="languageToggle"'), name + " missing language toggle");
    assert.ok(html.includes('id="cartOpen"') && html.includes('id="cartDrawer"'), name + " missing shared cart access");
    assert.ok(html.includes('id="checkoutModal"') && html.includes('data-i18n="cartDisclaimer"') && html.includes('data-i18n="demoOnly"'), name + " missing demo-only checkout notice");
    assert.match(html, /src="script\.js\?v=[\w-]+"/, name + " not loading the shared, versioned script");
  }
});

test("all page copy has EN and FR translations", () => {
  const translations = script.match(/const translations = \{([\s\S]*?)\n\};/);
  assert.ok(translations, "translation dictionary missing");
  const source = translations[1];
  const en = source.match(/en: \{([\s\S]*?)\n \},\n fr:/)?.[1] || "";
  const fr = source.match(/fr: \{([\s\S]*?)\n \}/)?.[1] || "";
  for (const { name, html } of pages) {
    const keys = new Set([...html.matchAll(/data-i18n(?:-placeholder|-aria-label)?="([^"]+)"/g)].map((m) => m[1]));
    for (const key of keys) {
      assert.ok(new RegExp("\\b" + key + ":").test(en), name + " missing EN translation for " + key);
      assert.ok(new RegExp("\\b" + key + ":").test(fr), name + " missing FR translation for " + key);
    }
  }
});

test("member page before sign-ups: one honest state, no personal-data shells, no dead buttons (owner 21:30/21:31)", () => {
  const member = pages.find((page) => page.name === "member.html").html;
  assert.ok(member.includes('data-i18n="navMajlis"'));
  assert.ok(member.includes('data-i18n="memberSoonTitle"') && member.includes('data-i18n="memberNotice"'));
  for (const k of ["memberCardKicker", "memberStatusValue", "memberPointsValue", "memberPointsLabel", "memberStatusLabel"]) assert.ok(!member.includes(`data-i18n="${k}"`), k + " shell must not render for a visitor");
  const main = member.slice(member.indexOf("<main"), member.indexOf("</main>"));
  assert.doesNotMatch(main, /<button[^>]*\bdisabled\b/, "no disabled pseudo-buttons on the page body");
  assert.match(member, /<a class="button button-gold" href="menu\.html" data-i18n="reserveMeanwhile">/, "the only action is a real link");
  assert.ok(!member.includes("<form") && !member.includes("<input"), "no credentials or personal details are collected");
});

test("cart and language state are persisted safely between pages", () => {
  assert.ok(script.includes('localStorage.getItem("azal-demo-cart-v1")'));
  assert.ok(script.includes('localStorage.setItem("azal-demo-cart-v1"'));
  assert.ok(script.includes('localStorage.getItem("azal-language")'));
  assert.ok(script.includes('localStorage.setItem("azal-language",language)'));
  assert.ok(script.includes("function loadCart()") && script.includes("function persistCart()"));
});
