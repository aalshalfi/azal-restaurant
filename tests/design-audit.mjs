// Design audit for the 5 binding P1 v2 points (lead ruling 2026-11-25 22:10).
// Local tool, not part of CI (needs Playwright + Chromium). Usage:
//   node tests/design-audit.mjs [rootDir=.] [port=8765]
// Serves rootDir over http, drives Chromium at 390x844 and 1440x900, prints one PASS/FAIL line per check and exits 1 on any FAIL.
// Limits: no internet in some sandboxes, so web fonts/photos may not load; computed font sizes, boxes and
// colors still measure correctly. It cannot judge imagery or visual taste. Live QA stays the release gate.
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = path.resolve(process.argv[2] || "."); const port = Number(process.argv[3] || 8765);
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2" };
const server = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split("?")[0]); if (p.endsWith("/")) p += "index.html"; const f = path.join(root, p); if (!f.startsWith(root) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); }).listen(port);
const browser = await chromium.launch(); const out = []; const add = (id, pass, detail) => out.push({ id, pass, detail });
const lum = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
// ---- mobile 390x844
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(`http://localhost:${port}/index.html`); await p.waitForTimeout(700);
  const m = await p.evaluate(() => {
    const vis = (el) => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && +s.opacity > 0; };
    const cart = document.getElementById("cartOpen"); const cr_ = cart.getBoundingClientRect();
    const inView = vis(cart) && cr_.top >= 0 && cr_.bottom <= innerHeight && cr_.left >= 0 && cr_.right <= innerWidth;
    const tiny = []; const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n; (n = walker.nextNode());) { const t = n.nodeValue.trim(); const el = n.parentElement; if (!t || !el || !vis(el) || ["SCRIPT", "STYLE", "NOSCRIPT"].includes(el.tagName)) continue; const fs_ = parseFloat(getComputedStyle(el).fontSize); if (fs_ < 12) tiny.push(`${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]}:${fs_}px:"${t.slice(0, 24)}"`); }
    const cards = [...document.querySelectorAll("#productGrid > *")].filter(vis); const first = cards[0]?.getBoundingClientRect();
    const hero = document.querySelector(".hero")?.getBoundingClientRect(); const search = document.getElementById("menuSearch");
    const taps = [...document.querySelectorAll("button, a.btn, .menu-toggle, #languageToggle")].filter(vis).map((e) => { const r = e.getBoundingClientRect(); return { n: (e.id || e.className || e.tagName).toString().slice(0, 28), w: Math.round(r.width), h: Math.round(r.height) }; }).filter((t) => t.h < 44 || t.w < 44);
    return { hOverflow: document.documentElement.scrollWidth > innerWidth, cartInView: inView, cartBox: [Math.round(cr_.width), Math.round(cr_.height)], bodyFont: parseFloat(getComputedStyle(document.body).fontSize), tinyCount: tiny.length, tinySample: tiny.slice(0, 6), cards: cards.length, firstCardTop: first ? Math.round(first.top + scrollY) : null, rowHeight: first ? Math.round(first.height) : null, heroH: hero ? Math.round(hero.height) : null, searchFont: search ? parseFloat(getComputedStyle(search).fontSize) : null, mutedColor: getComputedStyle(document.documentElement).getPropertyValue("--muted").trim(), smallTaps: taps.slice(0, 8), pageH: document.documentElement.scrollHeight };
  });
  await p.evaluate(() => scrollTo(0, 2400)); await p.waitForTimeout(250);
  const sticky = await p.evaluate(() => { const c = document.getElementById("cartOpen"), r = c.getBoundingClientRect(), s = getComputedStyle(c); const bar = document.querySelector("[data-sticky-cart], .cart-bar, .sticky-cart, .mobile-cart"); const br = bar?.getBoundingClientRect(); return (s.visibility !== "hidden" && r.width > 0 && r.top >= 0 && r.bottom <= innerHeight) || (!!br && br.width > 0 && br.top >= 0 && br.bottom <= innerHeight + 1); });
  add("1 cart visible on mobile without opening menu (scroll 0)", m.cartInView, `box ${m.cartBox}`);
  add("1b cart still reachable after scrolling 2400px (sticky)", sticky, sticky ? "ok" : "cart not in viewport");
  add("2 first dish starts within first screen (<=844px from top)", m.firstCardTop !== null && m.firstCardTop <= 844, `first dish top ${m.firstCardTop}px`);
  add("3a base body font >=16px", m.bodyFont >= 16, `${m.bodyFont}px`);
  add("3b no visible text under 12px", m.tinyCount === 0, `${m.tinyCount} elements; e.g. ${m.tinySample.join(" | ")}`);
  add("3c search input >=16px (no iOS zoom)", m.searchFont >= 16, `${m.searchFont}px`);
  add("3d --muted contrast on ivory >=4.5", /^#[0-9a-f]{6}$/i.test(m.mutedColor) && cr(m.mutedColor, "#F8F1E7") >= 4.5, `${m.mutedColor} -> ${/^#[0-9a-f]{6}$/i.test(m.mutedColor) ? cr(m.mutedColor, "#F8F1E7") : "n/a"}:1`);
  add("4 hero <=440px tall on mobile", m.heroH !== null && m.heroH <= 440, `${m.heroH}px`);
  add("5 dish row <=140px tall on mobile", m.rowHeight !== null && m.rowHeight <= 140, `${m.rowHeight}px per dish, ${m.cards} dishes`);
  add("X tap targets >=44x44", m.smallTaps.length === 0, m.smallTaps.map((t) => `${t.n} ${t.w}x${t.h}`).join(", ") || "ok");
  add("X no horizontal overflow, no page errors", !m.hOverflow && errs.length === 0, `overflow=${m.hOverflow} errors=${errs.length}`);
  out.push({ id: "info mobile page height", pass: null, detail: `${m.pageH}px` });
  await ctx.close();
}
// ---- desktop sanity
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(`http://localhost:${port}/index.html`); await p.waitForTimeout(500);
  const d = await p.evaluate(() => { const g = document.getElementById("productGrid"); const cols = getComputedStyle(g).gridTemplateColumns.split(" ").length; const c = document.getElementById("cartOpen").getBoundingClientRect(); return { cols, cartOk: c.width > 0 && c.top >= 0, hOverflow: document.documentElement.scrollWidth > innerWidth }; });
  add("D desktop keeps rich grid (>=2 columns)", d.cols >= 2, `${d.cols} columns`);
  add("D desktop cart visible, no overflow, no errors", d.cartOk && !d.hOverflow && errs.length === 0, JSON.stringify(d));
  await ctx.close();
}
await browser.close(); server.close();
const fails = out.filter((o) => o.pass === false).length;
for (const o of out) console.log(`${o.pass === true ? "PASS" : o.pass === false ? "FAIL" : "INFO"}  ${o.id} -- ${o.detail}`);
console.log(`\nSUMMARY: ${out.filter((o) => o.pass === true).length} pass, ${fails} fail`); process.exit(fails ? 1 : 0);
