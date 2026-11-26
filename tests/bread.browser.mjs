// Bread Clock on the menu. Run: node tests/bread.browser.mjs
import { createRequire } from "node:module"; import http from "node:http"; import { readFileSync, existsSync } from "node:fs"; import { join, extname } from "node:path";
const require = createRequire(process.env.NODE_PATH ? join(process.env.NODE_PATH, "x") : import.meta.url); const { chromium } = require("playwright");
const root = new URL("..", import.meta.url).pathname; const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff": "font/woff" };
const srv = http.createServer((q, r) => { const p = join(root, decodeURIComponent(q.url.split("?")[0])); if (!existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": T[extname(p)] || "application/octet-stream" }); r.end(readFileSync(p)); }).listen(0);
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
const b = await chromium.launch(); const base = `http://localhost:${srv.address().port}`;
{ const p = await b.newPage({ viewport: { width: 390, height: 900 } }); await p.goto(base + "/menu.html"); await p.waitForSelector(".bread-toggle");
  ok(await p.locator(".bread-toggle").count() === 3, "three bread dishes get 'How to eat it' (fahsa, saltah, sahawiq)");
  const fahsa = p.locator('.product-card:has([data-add="4"])');
  await fahsa.locator(".bread-toggle").click();
  ok(await fahsa.locator(".bread-steps").isVisible() && await fahsa.locator(".bread-toggle").getAttribute("aria-expanded") === "true" && /Tear a piece of bread/.test(await fahsa.textContent()), "opens tear / scoop / eat, aria-expanded true");
  ok(await p.locator('.product-card:has([data-add="1"]) .bread-how').count() === 0, "mandi gets nothing (its story is not about bread)");
  await p.waitForTimeout(1000); await fahsa.screenshot({ path: process.env.SHOT || "/tmp/bread.png" });
  await p.click('[data-category="Rice"]').catch(() => {}); await p.click('[data-category="All"]').catch(() => {}); await p.waitForTimeout(150);
  ok(await p.locator(".bread-toggle").count() === 3, "survives the menu re-render (filter)");
  ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), "390px: no overflow"); await p.close(); }
{ const p = await b.newPage({ viewport: { width: 320, height: 900 } }); await p.addInitScript(() => localStorage.setItem("azal-language", "ar")); await p.goto(base + "/menu.html"); await p.waitForSelector(".bread-toggle");
  await p.locator(".bread-toggle").first().click(); const t = await p.textContent(".bread-steps:not([hidden])");
  ok(/اغرف بها/.test(t) && !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), "Arabic at 320px, no overflow"); await p.close(); }
await b.close(); srv.close(); console.log(fails ? `${fails} failed` : "all passed"); process.exit(fails ? 1 : 0);
