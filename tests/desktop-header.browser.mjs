// F-OWN-15 (owner, laptop 15:53): the desktop header is one deliberate arrangement: brand at the start edge; nav,
// language and order button one group at the end, evenly spaced, one height, no void. EN + AR (RTL), 6 pages,
// 1024/1280/1440. Mobile is covered by header.browser.mjs. Run: node tests/desktop-header.browser.mjs
import { createRequire } from "node:module"; import http from "node:http"; import { readFileSync, existsSync } from "node:fs"; import { join, extname } from "node:path";
import { nullConfig } from "./null-config.mjs";
const require = createRequire(process.env.NODE_PATH ? join(process.env.NODE_PATH, "x") : import.meta.url); const { chromium } = require("playwright");
const root = new URL("..", import.meta.url).pathname; const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2" };
const srv = http.createServer((q, r) => { const p = join(root, decodeURIComponent(q.url.split("?")[0]).replace(/^\/azal-restaurant\//, "/")); if (!existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": T[extname(p)] || "application/octet-stream" }); r.end(readFileSync(p)); }).listen(0);
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
const b = nullConfig(await chromium.launch()); const base = `http://localhost:${srv.address().port}`;
for (const lang of ["en", "ar"]) for (const pg of ["index", "menu", "member", "reserve", "story", "404"]) for (const w of [1024, 1280, 1440]) {
  const p = await b.newPage({ viewport: { width: w, height: 400 } });
  await p.addInitScript((l) => localStorage.setItem("azal-language", l), lang);
  await p.goto(`${base}/${pg}.html`); await p.waitForTimeout(150);
  const m = await p.evaluate(() => {
    const R = (s) => { const e = document.querySelector(s); if (!e || getComputedStyle(e).display === "none") return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, h: r.height, t: r.top }; };
    const hdr = document.querySelector(".site-header"), cs = getComputedStyle(hdr), pad = parseFloat(cs.paddingLeft);
    const links = [...document.querySelectorAll(".nav a")].map((a) => a.getBoundingClientRect());
    return { brand: R(".brand"), nav: R(".nav"), lang: R("#languageToggle"), cart: R(".cart-open"), pad, rtl: document.documentElement.dir === "rtl", vw: innerWidth, ovf: document.documentElement.scrollWidth - innerWidth,
      gaps: links.slice(1).map((r, i) => Math.abs(document.documentElement.dir === "rtl" ? links[i].left - r.right : r.left - links[i].right)) };
  });
  const cart = m.cart, lang_ = m.lang, brand = m.brand;
  const langCartGap = cart ? (m.rtl ? lang_.l - cart.r : cart.l - lang_.r) : 0; // reserve has no order button
  const brandAtStart = m.rtl ? Math.abs(m.vw - m.pad - brand.r) < 2 : Math.abs(brand.l - m.pad) < 2;
  const groupAtEnd = m.rtl ? Math.abs((cart || lang_).l - m.pad) < 2 : Math.abs((cart || lang_).r - (m.vw - m.pad)) < 2;
  const evenNav = m.gaps.length ? Math.max(...m.gaps) - Math.min(...m.gaps) < 2 : true;
  const oneHeight = !cart || Math.abs(cart.h - lang_.h) < 1;
  ok(brandAtStart && groupAtEnd && (!cart || (langCartGap >= 12 && langCartGap <= 32)) && evenNav && oneHeight && m.ovf <= 0,
    `${lang} ${pg} @${w}: brand at start, one group at the end, language→order gap ${Math.round(langCartGap)}px, even nav, same height, no overflow`);
  await p.close();
}
await b.close(); srv.close(); if (fails) { console.log(fails + " failed"); process.exit(1); } else console.log("all passed");
