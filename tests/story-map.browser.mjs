// Story map in a real browser. Run: node tests/story-map.browser.mjs
import { createRequire } from "node:module"; import http from "node:http"; import { readFileSync, existsSync } from "node:fs"; import { join, extname } from "node:path";
const require = createRequire(process.env.NODE_PATH ? join(process.env.NODE_PATH, "x") : import.meta.url); const { chromium } = require("playwright");
const root = new URL("..", import.meta.url).pathname; const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };
const srv = http.createServer((q, r) => { const p = join(root, decodeURIComponent(q.url.split("?")[0])); if (!existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": T[extname(p)] || "application/octet-stream" }); r.end(readFileSync(p)); }).listen(0);
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
const b = await chromium.launch(); const base = `http://localhost:${srv.address().port}`;
for (const w of [390, 1280]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  await p.goto(base + "/story.html"); await p.waitForSelector("#yemenMap .ymap-tab");
  ok(await p.locator(".ymap-tab").count() === 4 && /Lamb Mandi/.test(await p.textContent("#ymapPanel")), `${w}: 4 regions; Hadramaut shows mandi first`);
  await p.click("#ymap-aden"); ok(/Adeni Chai/.test(await p.textContent("#ymapPanel")) && await p.locator(".ymap-dot.is-on[data-region=aden]").count() === 1, `${w}: tap Aden -> chai, dot highlighted`);
  await p.click("#ymap-tihama"); ok(/Mango/.test(await p.textContent("#ymapPanel")) && await p.evaluate(() => getComputedStyle(document.querySelector(".ymap-dot")).pointerEvents) === "none", `${w}: map is decorative; tabs are the only control`);
  await p.focus("#ymap-tihama"); await p.keyboard.press("ArrowRight"); ok(await p.evaluate(() => document.activeElement.id) === "ymap-hadramaut", `${w}: arrow keys move between regions (wraps)`);
  ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `${w}: no horizontal overflow`);
  if (w === 390) { await p.click("#ymap-sanaa"); await p.waitForTimeout(400); await p.locator("#yemenMap").screenshot({ path: process.env.SHOT || "/tmp/ymap.png" }); }
  await p.close();
}
{ const p = await b.newPage(); await p.addInitScript(() => localStorage.setItem("azal-language", "fr")); await p.goto(base + "/story.html"); await p.waitForSelector(".ymap-tab");
  await p.click("#ymap-sanaa"); const t = await p.textContent("#yemenMap");
  ok(/Hauts plateaux de Sanaa/.test(t) && /Saltah yéménite/.test(t) && /Voir au menu/.test(t), "French names and dish stories"); await p.close(); }
{ const p = await b.newPage(); await p.addInitScript(() => localStorage.setItem("azal-language", "en")); await p.goto(base + "/story.html"); await p.waitForSelector(".ymap-tab");
  await p.evaluate(() => { document.documentElement.lang = "ar"; }); await p.waitForTimeout(100); const t = await p.textContent("#yemenMap");
  ok(/اختر منطقة/.test(t) && /حضرموت/.test(t) && /خريطة مبسّطة/.test(t), "Arabic hint, region names and caption"); await p.close(); }
{ const p = await b.newPage(); await p.addInitScript(() => localStorage.setItem("azal-language", "ar")); await p.goto(base + "/story.html"); await p.waitForSelector(".ymap-tab");
  await p.focus("#ymap-hadramaut"); await p.keyboard.press("ArrowLeft");
  const a = await p.evaluate(() => document.activeElement.id); await p.keyboard.press("ArrowRight"); const b2 = await p.evaluate(() => document.activeElement.id);
  ok(await p.evaluate(() => document.documentElement.dir) === "rtl" && a === "ymap-sanaa" && b2 === "ymap-hadramaut", "RTL: ArrowLeft moves to the next region, ArrowRight back (got " + a + ", " + b2 + ")"); await p.close(); }
await b.close(); srv.close(); console.log(fails ? `${fails} failed` : "all passed"); process.exit(fails ? 1 : 0);
