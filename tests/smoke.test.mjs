// Runtime smoke test for the AZAL static site (no dependencies).
//
// Why this exists: `node --check` only finds syntax errors. A typo such as
// `document.document.documentElement` is valid syntax but throws when the
// language toggle runs, so the EN/FR switch silently did nothing (task C8).
// This test loads index.html and script.js into a tiny fake DOM, then presses
// the real handlers and checks the results.
//
// Limits: it is a fake DOM, not a browser. It does not check layout, images,
// fonts or the published URL. A passing run does not replace live QA.
//
// Run: node --test tests/
// Override the script under test: SCRIPT_PATH=/path/to/script.js node --test tests/

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "menu.html"), "utf8");
const homeHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const storyHtml = fs.readFileSync(path.join(root, "story.html"), "utf8");
const memberHtml = fs.readFileSync(path.join(root, "member.html"), "utf8");
const scriptPath = process.env.SCRIPT_PATH || path.join(root, "script.js");
const source = fs.readFileSync(scriptPath, "utf8");

// ---- minimal fake DOM -------------------------------------------------------

const camel = (name) => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

class El {
  constructor(tag, attrs = {}) {
    this.tag = tag;
    this.attrs = { ...attrs };
    this.listeners = {};
    this.innerHTML = "";
    this.value = "";
    this.placeholder = "";
    this.style = {};
    this._text = "";
    this._classes = new Set((attrs.class || "").split(/\s+/).filter(Boolean));
    this.classList = {
      add: (...c) => c.forEach((x) => this._classes.add(x)),
      remove: (...c) => c.forEach((x) => this._classes.delete(x)),
      toggle: (c, force) => {
        const on = force === undefined ? !this._classes.has(c) : Boolean(force);
        if (on) this._classes.add(c);
        else this._classes.delete(c);
        return on;
      },
      contains: (c) => this._classes.has(c),
    };
    this.dataset = {};
    for (const [k, v] of Object.entries(attrs)) {
      if (k.startsWith("data-")) this.dataset[camel(k.slice(5))] = v;
    }
  }
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  hasAttribute(k) { return k in this.attrs; }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  removeEventListener() {}
  focus() {}
  blur() {}
  scrollIntoView() { this.scrolled = true; }
  closest() { return null; }
  contains() { return false; }
  querySelector(sel) { return find(sel)[0] || null; }
  querySelectorAll(sel) { return find(sel); }
}

const all = [];
const byId = new Map();
for (const m of html.matchAll(/<([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g)) {
  const attrs = {};
  for (const a of m[2].matchAll(/([:\w-]+)(?:="([^"]*)")?/g)) attrs[a[1]] = a[2] ?? "";
  const el = new El(m[1].toLowerCase(), attrs);
  all.push(el);
  if (attrs.id) byId.set(attrs.id, el);
}

// Supports only the selector shapes script.js uses: [attr], tag, .class, tag.class, tag[attr].
function find(sel) {
  const m = sel.match(/^([a-z0-9]*)(?:\.([\w-]+))?(?:\[([\w-]+)\])?$/i);
  if (!m) return [];
  const [, tag, cls, attr] = m;
  return all.filter(
    (el) =>
      (!tag || el.tag === tag.toLowerCase()) &&
      (!cls || el._classes.has(cls)) &&
      (!attr || attr in el.attrs),
  );
}

function boot(storage = new Map()) {
  const documentElement = new El("html", { lang: "en" });
  const body = new El("body");
  const documentStub = {
    documentElement,
    body,
    getElementById: (id) => byId.get(id) || null,
    querySelector: (sel) => find(sel)[0] || null,
    querySelectorAll: (sel) => find(sel),
    addEventListener() {},
  };
  const context = vm.createContext({
    document: documentStub,
    console,
    Intl,
    Date,
    Number,
    Map,
    Set,
    JSON,
    Object,
    Array,
    String,
    Math,
    localStorage: { getItem: (key) => storage.has(key) ? storage.get(key) : null, setItem: (key, value) => storage.set(key, String(value)) },
  });
  context.window = context;
  context.matchMedia = () => ({ matches: false });
  vm.runInContext(source, context, { filename: "script.js" });
  const evalIn = (code) => vm.runInContext(code, context);
  return { documentElement, evalIn, storage };
}

const fire = (el, type, event = {}) => (el.listeners[type] || []).forEach((fn) => fn(event));
const clone = (value) => JSON.parse(JSON.stringify(value));

// ---- tests ------------------------------------------------------------------

test("script loads and renders the sample menu", () => {
  boot();
  const cards = (byId.get("productGrid").innerHTML.match(/class="product-card"/g) || []).length;
  assert.equal(cards, 9, "expected 9 sample dish cards");
});

test("EN/FR switch runs without throwing and translates the page", () => {
  const { documentElement, evalIn } = boot();
  const toggle = byId.get("languageToggle");
  assert.ok(toggle, "languageToggle button is missing from index.html");

  const translations = clone(evalIn("translations"));
  const productTranslations = clone(evalIn("productTranslations"));
  const grid = byId.get("productGrid");

  fire(toggle, "click"); // would throw on the document.document typo
  assert.equal(evalIn("language"), "fr");
  assert.equal(documentElement.lang, "fr");
  assert.equal(toggle.textContent, "EN", "button should offer the way back to English");
  assert.ok(
    grid.innerHTML.includes(productTranslations[1].name),
    "menu should show the French dish name after switching",
  );

  const probe = all.find((el) => {
    const key = el.dataset.i18n;
    return key && translations.en[key] && translations.fr[key] && translations.en[key] !== translations.fr[key];
  });
  assert.ok(probe, "no data-i18n element with a different French string was found");
  assert.equal(probe.textContent, translations.fr[probe.dataset.i18n], "page copy was not translated");

  fire(toggle, "click");
  assert.equal(evalIn("language"), "en");
  assert.equal(documentElement.lang, "en");
  assert.equal(toggle.textContent, "FR");
  assert.equal(probe.textContent, translations.en[probe.dataset.i18n]);
});

test("cart contents survive a language switch", () => {
  const { evalIn } = boot();
  const grid = byId.get("productGrid");
  fire(grid, "click", {
    target: { closest: (sel) => (sel === "[data-add]" ? { dataset: { add: "1" } } : null) },
  });
  assert.equal(evalIn("cart.size"), 1);
  fire(byId.get("languageToggle"), "click");
  assert.equal(evalIn("cart.size"), 1);
  assert.equal(evalIn("cart.get(1)"), 1);
});

test("search clears an active Sufra guide instead of stranding the guest (C10)", () => {
  const { evalIn } = boot();
  const compass = byId.get("sufraCompass");
  const search = byId.get("menuSearch");
  const grid = byId.get("productGrid");
  const sidesBtn = all.find((el) => el.dataset.sufraCategory === "Sides");
  assert.ok(sidesBtn, "Sides guide button is missing from index.html");

  // One tap on "Start with sides" filters to the 2 sides.
  fire(compass, "click", {
    target: { closest: (sel) => (sel === "button[data-sufra-category]" ? sidesBtn : null) },
  });
  assert.equal(evalIn("activeGuide"), "Sides");
  assert.equal((grid.innerHTML.match(/class="product-card"/g) || []).length, 2);

  // Typing a search must release the guide and search the whole menu.
  search.value = "mandi";
  fire(search, "input", { target: search });
  assert.equal(evalIn("activeGuide"), null);
  assert.equal(sidesBtn.classList.contains("active"), false);
  const cards = (grid.innerHTML.match(/class="product-card"/g) || []).length;
  assert.equal(cards, 2, "searching 'mandi' should find the two mandi dishes, not an empty menu");
  assert.ok(grid.innerHTML.includes("Lamb Mandi") && grid.innerHTML.includes("Chicken Mandi"));
});

test("every translation key used by menu.html exists in English and French", () => {
  const { evalIn } = boot();
  const translations = clone(evalIn("translations"));
  const used = new Set();
  for (const m of html.matchAll(/data-i18n(?:-placeholder|-aria-label)?="([^"]+)"/g)) used.add(m[1]);
  const missing = [];
  for (const key of used) {
    for (const lang of ["en", "fr"]) {
      if (!translations[lang]?.[key]) missing.push(`${lang}:${key}`);
    }
  }
  assert.deepEqual(missing, [], `missing translation keys: ${missing.join(", ")}`);
});

test("every sample dish has a French translation", () => {
  const { evalIn } = boot();
  const ids = clone(evalIn("products.map((p) => p.id)"));
  const translated = Object.keys(clone(evalIn("productTranslations"))).map(Number);
  assert.deepEqual(ids.filter((id) => !translated.includes(id)), []);
});


test("sticky demo cart stays reachable and mirrors cart count and total", () => {
  const { evalIn } = boot();
  const grid = byId.get("productGrid");
  const sticky = byId.get("stickyCartBar");
  assert.ok(sticky, "sticky cart control is missing");
  assert.ok(html.indexOf('id="cartOpen"') > html.indexOf("</nav>"), "header cart must remain outside the mobile hamburger menu");
  assert.equal(sticky.hidden, true, "empty cart should start hidden");

  fire(grid, "click", {
    target: { closest: (sel) => (sel === "[data-add]" ? { dataset: { add: "1" } } : null) },
  });
  assert.equal(sticky.hidden, false, "sticky cart should appear after adding a sample item");
  assert.equal(byId.get("stickyCartCount").textContent, "1");
  assert.equal(byId.get("stickyCartTotal").textContent, "$24.99");

  fire(sticky, "click");
  assert.ok(byId.get("cartDrawer").classList.contains("open"), "sticky cart should open the demo drawer");
});

test("P1 v3 separates Home, Menu and Story; commerce stays on Menu", () => {
  assert.ok(homeHtml.includes('class="hero"') && homeHtml.includes('class="signature-section'), "Home should contain the short hero and signature selection");
  assert.ok(!homeHtml.includes('id="productGrid"') && !homeHtml.includes('id="menuSearch"'), "Home must not contain the full menu surface");
  assert.ok(html.includes('id="productGrid"') && html.includes('id="menuSearch"') && html.includes('id="sufra-guide"'), "Menu page must contain the full menu and Sufra guide");
  assert.ok(storyHtml.includes('class="story-values') && storyHtml.includes('class="majlis-preview'), "Story page should carry the heritage and Majlis concept");
  assert.ok(html.includes('class="sticky-cart"'), "sticky cart belongs on the Menu page");
  assert.ok(!homeHtml.includes('class="sticky-cart"') && !storyHtml.includes('class="sticky-cart"') && !memberHtml.includes('class="sticky-cart"'), "sticky cart must only appear on Menu");
  assert.ok(memberHtml.includes('class="member-card"') && memberHtml.includes('memberPointsValue'), "Member page should show an inert membership and points preview");
  assert.ok(!memberHtml.includes("<form") && !memberHtml.includes("<input"), "Member preview must not collect credentials or personal data");
  for (const page of [homeHtml, html, storyHtml, memberHtml]) {
    assert.ok(page.includes('id="languageToggle"') && page.includes('id="cartOpen"') && page.includes('id="cartDrawer"'), "shared language and cart controls must exist on every page");
    assert.ok(!page.includes('id="customerName"') && !page.includes('id="orderType"'), "demo checkout must not collect customer details or offer delivery");
  }
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  assert.ok(css.includes(".sticky-cart{position:fixed"), "sticky cart should remain fixed at all scroll depths");
  assert.ok(css.includes(".product-card{display:grid;grid-template-columns:96px"), "mobile menu cards should use compact horizontal rows");
});


test("Source font families are self-hosted and licensed in the repository", () => {
  assert.ok(!html.includes("fonts.googleapis.com") && !html.includes("fonts.gstatic.com"), "site should not request Google Fonts at runtime");
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  assert.ok(css.includes("@font-face{font-family:'Source Sans 3'"), "Source Sans 3 @font-face is missing");
  assert.ok(css.includes("@font-face{font-family:'Source Serif 4'"), "Source Serif 4 @font-face is missing");
  for (const file of [
    "assets/fonts/SourceSans3VF-Upright.woff2",
    "assets/fonts/SourceSerif4Variable-Roman.woff2",
    "assets/fonts/SourceSerif4Variable-Italic.woff2",
    "assets/fonts/OFL-Source-Sans-3.txt",
    "assets/fonts/OFL-Source-Serif-4.txt",
  ]) assert.ok(fs.existsSync(path.join(root, file)), `missing self-hosted font asset: ${file}`);
});


test("P1 mobile CSS closes the interim C-DES size and tap-target gaps", () => {
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  assert.ok(css.includes(".hero-bottom,.hero-bottom span{font-size:12px!important"), "hero meta spans must meet the 12px floor");
  assert.ok(css.includes(".product-category{font-size:12px!important"), "product category labels must meet the 12px floor");
  assert.ok(css.includes(".product-tag{font-size:12px!important"), "product tags must meet the 12px floor");
  assert.ok(css.includes(".add-button{min-height:44px;height:44px"), "add buttons must be at least 44px tall");
  assert.ok(css.includes(".section-kicker{white-space:normal"), "long French section kickers must wrap");
  assert.ok(css.includes("-webkit-line-clamp:2"), "mobile dish descriptions must be clamped to two lines");
});


test("cart and language persist across page loads", () => {
  const storage = new Map([["azal-demo-cart-v1", "[[1,2]]"], ["azal-language", "fr"]]);
  const { evalIn, documentElement, storage: saved } = boot(storage);
  assert.equal(evalIn("language"), "fr");
  assert.equal(documentElement.lang, "fr");
  assert.equal(evalIn("cart.get(1)"), 2);
  evalIn("cart.set(2, 1); renderCart();");
  assert.equal(saved.get("azal-demo-cart-v1"), "[[1,2],[2,1]]");
  assert.equal(saved.get("azal-language"), "fr");
});
