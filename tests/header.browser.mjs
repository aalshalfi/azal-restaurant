// HDR-MOB browser check: logo + four controls visible, 44x44, inside the viewport and not overlapping, at 320/390;
// 404.html uses <base href="/azal-restaurant/">, so the local server strips that prefix.
// desktop quick controls hidden at 1280. Run: node tests/header.browser.mjs
import { createRequire } from "node:module"; import http from "node:http"; import { readFileSync, existsSync } from "node:fs"; import { join, extname } from "node:path";
import { nullConfig } from "./null-config.mjs";
const require = createRequire(process.env.NODE_PATH ? join(process.env.NODE_PATH, "x") : import.meta.url); const { chromium } = require("playwright");
const root = new URL("..", import.meta.url).pathname; const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };
const srv = http.createServer((q, r) => { const p = join(root, decodeURIComponent(q.url.split("?")[0]).replace(/^\/azal-restaurant\//, "/")); if (!existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": T[extname(p)] || "application/octet-stream" }); r.end(readFileSync(p)); }).listen(0);
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
const b = nullConfig(await chromium.launch()); const base = `http://localhost:${srv.address().port}`;
const SEL = [".brand", ".language-quick", ".majlis-quick", ".cart-open", ".menu-toggle"];
for (const lang of ["en", "ar"]) for (const page_ of ["index", "menu", "member", "reserve", "story", "404"]) for (const w of [320, 390]) {
  const page = await b.newPage({ viewport: { width: w, height: 640 } });
  await page.addInitScript((l) => localStorage.setItem("azal-language", l), lang);
  await page.goto(`${base}/${page_}.html`); await page.waitForTimeout(150);
  // reserve.html is table-only (ChatGPT #32 review): no food cart in its header, so 3 controls there
  const r = await page.evaluate((sel) => sel.filter((s) => document.querySelector(s)).map((s) => { const e = document.querySelector(s), b = e.getBoundingClientRect(), cs = getComputedStyle(e); return { s, l: b.left, r: b.right, t: b.top, bt: b.bottom, w: b.width, h: b.height, vis: cs.display !== "none" && cs.visibility !== "hidden" && b.width > 0 }; }), SEL);
  const hh = await page.evaluate(() => document.querySelector(".site-header").getBoundingClientRect().height);
  const ovf = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  const allVis = r.every((x) => x.vis && x.l >= 0 && x.r <= w && x.t >= 0 && x.bt <= hh + 0.5);
  const sizes = r.slice(1).every((x) => Math.round(x.w) >= 44 && Math.round(x.h) >= 44);
  let overlap = false; for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) if (r[i].l < r[j].r - 0.5 && r[j].l < r[i].r - 0.5) overlap = true;
  const order = lang === "ar" ? r.every((x, i) => i === 0 || x.r <= r[i - 1].l + 0.5) : r.every((x, i) => i === 0 || x.l >= r[i - 1].r - 0.5); // RTL mirrors the row
  ok(r.length === (page_ === "reserve" ? 4 : 5) && allVis && sizes && !overlap && order && !ovf && Math.round(hh) === 64, `${lang} ${page_} @${w}: logo + ${page_ === "reserve" ? 3 : 4} controls visible, 44x44, in order, no overlap, header 64px, no overflow`);
  await page.close();
}
{
  const page = await b.newPage({ viewport: { width: 1280, height: 400 } });
  await page.goto(`${base}/index.html`);
  const d = await page.evaluate(() => ({ quick: getComputedStyle(document.querySelector(".header-quick")).display, icon: getComputedStyle(document.querySelector(".cart-open .cart-icon")).display, nav: getComputedStyle(document.querySelector(".nav")).display, label: getComputedStyle(document.querySelector(".cart-open .cart-label")).position }));
  ok(d.quick === "none" && d.icon === "none" && d.nav === "flex" && d.label !== "absolute", "1280: desktop unchanged (nav visible, text cart, no quick controls)");
  await page.close();
}
await b.close(); srv.close(); console.log(fails ? `${fails} failed` : "all passed"); process.exit(fails ? 1 : 0);
