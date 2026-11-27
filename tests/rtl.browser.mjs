// AR-RTL pass: the Arabic header is the mirror of the #33 family (logo at the start edge = right, controls grouped at the
// end edge = left, same logical order), and the physical-only rules that broke in RTL now use logical sides.
// Run: node tests/rtl.browser.mjs
import { createRequire } from "node:module"; import http from "node:http"; import { readFileSync, existsSync } from "node:fs"; import { join, extname } from "node:path";
import { nullConfig } from "./null-config.mjs";
const require = createRequire(process.env.NODE_PATH ? join(process.env.NODE_PATH, "x") : import.meta.url); const { chromium } = require("playwright");
const root = new URL("..", import.meta.url).pathname; const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff": "font/woff" };
const srv = http.createServer((q, r) => { const p = join(root, decodeURIComponent(q.url.split("?")[0]).replace(/^\/azal-restaurant\//, "/")); if (!existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": T[extname(p)] || "application/octet-stream" }); r.end(readFileSync(p)); }).listen(0);
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
const b = nullConfig(await chromium.launch()); const base = `http://localhost:${srv.address().port}`;
const CTRL = [".language-quick", ".majlis-quick", ".cart-open", ".menu-toggle"];
for (const w of [320, 390]) for (const pg of ["index", "menu", "member", "reserve", "story", "404"]) {
  const res = {};
  for (const lang of ["en", "ar"]) {
    const p = await b.newPage({ viewport: { width: w, height: 700 } });
    await p.addInitScript((l) => localStorage.setItem("azal-language", l), lang);
    await p.goto(`${base}/${pg}.html`); await p.waitForTimeout(150);
    res[lang] = await p.evaluate((sel) => { const r = (s) => document.querySelector(".site-header " + s)?.getBoundingClientRect(); const bar = document.querySelector(".site-header").getBoundingClientRect();
      return { dir: document.documentElement.dir, vw: innerWidth, bar: bar.height, brand: r(".brand"), ctrls: sel.map((s) => r(s)) }; }, pg === "reserve" ? CTRL.filter((c) => c !== ".cart-open") : CTRL); // #32: reserve is table-only, no food cart
    await p.close();
  }
  const { en, ar } = res, tol = 2;
  const gapEN = en.brand.left, gapAR = ar.vw - ar.brand.right;
  ok(ar.dir === "rtl" && Math.abs(gapEN - gapAR) <= tol, `${pg} ${w}px: Arabic logo sits at the right edge with the same inset as English (${gapEN.toFixed(0)} vs ${gapAR.toFixed(0)})`);
  const arCtrlLeft = Math.min(...ar.ctrls.map((c) => c.left)), arCtrlRight = Math.max(...ar.ctrls.map((c) => c.right));
  ok(arCtrlRight < ar.brand.left && Math.abs(arCtrlLeft - (en.vw - Math.max(...en.ctrls.map((c) => c.right)))) <= tol, `${pg} ${w}px: Arabic controls grouped at the left edge, mirror of English`);
  const order = ar.ctrls.map((c) => c.left); // logical order language, account, order, menu runs right-to-left in Arabic
  ok(order.every((x, i) => i === 0 || x < order[i - 1]), `${pg} ${w}px: same logical order in Arabic (language → account → [order] → menu, right to left)`);
  ok(ar.bar === en.bar && ar.bar === 64 && ar.ctrls.every((c) => c.width >= 44 && c.height >= 44), `${pg} ${w}px: 64px bar, 44px targets in both`);
}
{ // checkout modal close button sits on the end side, clear of the kicker
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.addInitScript(() => { localStorage.setItem("azal-language", "ar"); localStorage.setItem("azal-demo-cart-v1", JSON.stringify([[1, 1]])); });
  await p.goto(`${base}/menu.html`); await p.evaluate(() => document.getElementById("cartOpen").click()); await p.click("#checkoutButton");
  const [x, k] = await p.evaluate(() => [document.querySelector("#modalClose").getBoundingClientRect(), document.querySelector(".checkout-panel .section-kicker").getBoundingClientRect()].map((r) => ({ l: r.left, r: r.right, t: r.top, b: r.bottom })));
  const overlap = !(x.r <= k.l || k.r <= x.l || x.b <= k.t || k.b <= x.t);
  ok(!overlap && x.l < 200, "ar: checkout × is on the left and no longer covers «معاينة»"); await p.close();
}
{ // numbered steps: the marker gutter is on the right in Arabic (no "1انضم" fusion)
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.addInitScript(() => localStorage.setItem("azal-language", "ar"));
  await p.goto(`${base}/member.html`);
  const pad = await p.evaluate(() => { const s = getComputedStyle(document.querySelector(".member-steps")); return [s.paddingRight, s.paddingLeft]; });
  ok(pad[0] === "22px" && pad[1] === "0px", "ar: member steps indent on the right (marker gutter), not the left"); await p.close();
}
{ // direction arrows point the reading way: hero button and sufra choices
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.addInitScript(() => localStorage.setItem("azal-language", "ar"));
  await p.goto(`${base}/index.html`); const h = await p.evaluate(() => getComputedStyle(document.querySelector(".hero .dir-arrow")).transform);
  await p.goto(`${base}/menu.html`); const m = await p.evaluate(() => getComputedStyle(document.querySelector(".sufra-arrow")).transform);
  ok(/^matrix\(-1/.test(h) && /^matrix\(-1/.test(m), "ar: ↗ arrows are mirrored to point the reading way"); await p.close();
}
await b.close(); srv.close(); console.log(fails ? `${fails} failed` : "all passed"); process.exit(fails ? 1 : 0);
