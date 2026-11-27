// Floating "View your order" bar (lead live QA 05:02: it overlapped dish cards on the Arabic menu at desktop width).
// The bar is fixed at every width, but the scroll padding that keeps focused controls clear of it applied only <=800px,
// so at 1280 a keyboard user could focus an Add button that stayed under the bar. Each Add button is placed under the
// bar, then focused: it must end up clear of it. EN/AR at 1280 and 390. Run: node tests/sticky-bar.browser.mjs
import { createRequire } from "node:module"; import http from "node:http"; import { readFileSync, existsSync } from "node:fs"; import { join, extname } from "node:path";
import { nullConfig } from "./null-config.mjs";
const require = createRequire(process.env.NODE_PATH ? join(process.env.NODE_PATH, "x") : import.meta.url); const { chromium } = require("playwright");
const root = new URL("..", import.meta.url).pathname; const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2" };
const srv = http.createServer((q, r) => { const p = join(root, decodeURIComponent(q.url.split("?")[0])); if (!existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": T[extname(p)] || "application/octet-stream" }); r.end(readFileSync(p)); }).listen(0);
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
const b = nullConfig(await chromium.launch()); const base = `http://localhost:${srv.address().port}`;
for (const lang of ["ar", "en"]) for (const [w, h] of [[1280, 800], [390, 844]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.addInitScript((l) => localStorage.setItem("azal-language", l), lang);
  await p.goto(base + "/menu.html"); await p.waitForSelector("[data-add]");
  await p.locator("[data-add]").first().click(); await p.waitForTimeout(300);
  if (await p.evaluate(() => document.querySelector("#cartDrawer")?.classList.contains("open"))) { await p.click("#cartClose"); await p.waitForTimeout(300); }
  const r = await p.evaluate(async () => {
    const bar = document.querySelector("#stickyCartBar"); if (!bar || bar.hidden) return { shown: false };
    const hit = (a, c) => a.bottom > c.top && a.top < c.bottom && a.right > c.left && a.left < c.right;
    document.documentElement.style.scrollBehavior = "auto"; let covered = 0; const ids = [...document.querySelectorAll("[data-add]")];
    for (const e of ids) { document.activeElement?.blur(); scrollBy(0, e.getBoundingClientRect().top - (bar.getBoundingClientRect().top + 4)); await new Promise((r) => setTimeout(r, 50));
      e.focus(); await new Promise((r) => setTimeout(r, 100)); if (hit(e.getBoundingClientRect(), bar.getBoundingClientRect())) covered++; }
    return { shown: true, covered, n: ids.length };
  });
  ok(r.shown && r.n === 9 && r.covered === 0, `${lang} @${w}: bar shown; every focused Add button ends clear of the bar (${r.covered}/${r.n} covered)`);
  await p.close();
}
await b.close(); srv.close(); if (fails) { console.log(fails + " failed"); process.exit(1); }
