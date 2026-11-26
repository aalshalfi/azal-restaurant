// Iftar Mode in a real browser with fixed clocks. Run: node tests/iftar.browser.mjs
import { createRequire } from "node:module"; import http from "node:http"; import { readFileSync, existsSync } from "node:fs"; import { join, extname } from "node:path";
const require = createRequire(process.env.NODE_PATH ? join(process.env.NODE_PATH, "x") : import.meta.url); const { chromium } = require("playwright");
const root = new URL("..", import.meta.url).pathname; const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };
const srv = http.createServer((q, r) => { const p = join(root, decodeURIComponent(q.url.split("?")[0])); if (!existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": T[extname(p)] || "application/octet-stream" }); r.end(readFileSync(p)); }).listen(0);
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
const b = await chromium.launch(); const base = `http://localhost:${srv.address().port}`;
async function at(iso, path, lang = "en") {
  const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  await page.clock.setFixedTime(new Date(iso));
  await page.addInitScript((l) => localStorage.setItem("azal-language", l), lang);
  await page.goto(base + path); await page.waitForTimeout(250); return page;
}
{ const p = await at("2026-11-26T17:00:00Z", "/index.html"); ok(await p.locator(".iftar-banner").count() === 0, "outside Ramadan: no banner, nothing changes"); await p.close(); }
{ const p = await at("2027-02-20T19:00:00Z", "/index.html"); // 14:00 Toronto, Ramadan 13
  const t = await p.textContent(".iftar-banner");
  ok(/Ramadan Mubarak/.test(t) && /Iftar in 3 h 3\d min · 5:\d\d\sp\.m\. in Ottawa/.test(t), "Ramadan day: live countdown to computed Ottawa iftar time");
  ok(/Umm al-Qura/.test(t) && /2-minute safety margin/.test(t) && /mosque/.test(t) && !/Preview/.test(t), "honest note: margin, calendar, follow your mosque; not marked preview");
  await p.screenshot({ path: process.env.SHOT || "/tmp/iftar.png" }); await p.close(); }
{ const p = await at("2027-02-20T19:00:00Z", "/menu.html");
  await p.evaluate(() => { localStorage.setItem("azal-demo-cart-v1", JSON.stringify([[1, 2]])); }); await p.reload(); await p.waitForTimeout(250);
  await p.click(".iftar-order"); await p.waitForTimeout(150);
  ok(await p.evaluate(() => document.getElementById("cartDrawer").getAttribute("aria-hidden")) === "false", "Order for iftar opens the cart when it has items");
  await p.evaluate(() => document.getElementById("checkoutButton").click()); await p.waitForTimeout(200);
  const chosen = await p.evaluate(() => pickupState.choice);
  ok(chosen === "1050", `pickup pre-selected at 17:30, the last 15-min slot at or before iftar 17:39 (got ${chosen})`);
  ok(/just before iftar/.test(await p.textContent("#cartStatus")), "screen-reader announcement of the iftar slot");
  await p.close(); }
{ const p = await at("2027-02-21T00:30:00Z", "/index.html"); // 19:30 Toronto
  ok(/Iftar was at 5:\d\d\sp\.m\. Tomorrow: 5:\d\d\sp\.m\./.test(await p.textContent(".iftar-banner")) && await p.locator(".iftar-order").count() === 0, "after sunset: tomorrow's time, no order button"); await p.close(); }
{ const p = await at("2027-02-20T19:00:00Z", "/index.html", "fr"); const t = await p.textContent(".iftar-banner");
  ok(/Ramadan Moubarak/.test(t) && /Iftar dans 3 h/.test(t) && /Commander pour l’iftar/.test(t), "French"); await p.close(); }
{ const p = await at("2026-11-26T17:00:00Z", "/index.html?iftar=preview"); ok(/Preview/.test(await p.textContent(".iftar-banner")), "?iftar=preview shows it on any day, clearly tagged"); await p.close(); }
for (const w of [320, 390]) { const p = await b.newPage({ viewport: { width: w, height: 700 } }); await p.clock.setFixedTime(new Date("2027-02-20T19:00:00Z")); await p.goto(base + "/index.html"); await p.waitForTimeout(200);
  ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `${w}px: no horizontal overflow`); await p.close(); }
await b.close(); srv.close(); console.log(fails ? `${fails} failed` : "all passed"); process.exit(fails ? 1 : 0);
