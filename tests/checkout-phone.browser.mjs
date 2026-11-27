// F-CHK-1/F-CHK-2 (owner on his phone, 21:58) + F-WALK-1/2 (lead walk 22:05). Phone heights where the sheet used to trap
// the guest; desktop must not regress. Run: node tests/checkout-phone.browser.mjs
import { createRequire } from "node:module"; import http from "node:http"; import { readFileSync, existsSync } from "node:fs"; import { join, extname } from "node:path";
import { nullConfig } from "./null-config.mjs";
const require = createRequire(process.env.NODE_PATH ? join(process.env.NODE_PATH, "x") : import.meta.url); const { chromium } = require("playwright");
const root = new URL("..", import.meta.url).pathname; const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff": "font/woff" };
const srv = http.createServer((q, r) => { const p = join(root, decodeURIComponent(q.url.split("?")[0])); if (!existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": T[extname(p)] || "application/octet-stream" }); r.end(readFileSync(p)); }).listen(0);
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
const b = nullConfig(await chromium.launch()); const base = `http://localhost:${srv.address().port}`;
const inView = (p, sel) => p.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.height > 0; }, sel);
async function openSheet(lang, vp, page = "menu") {
  const p = await b.newPage({ viewport: vp });
  await p.addInitScript((l) => { localStorage.setItem("azal-language", l); localStorage.setItem("azal-demo-cart-v1", JSON.stringify([[1, 2], [6, 1], [8, 2]])); }, lang);
  await p.clock.install({ time: new Date("2026-11-27T15:00:00Z") }); // 10:00 Toronto: before opening -> full slot grid
  await p.goto(`${base}/${page}.html`); await p.evaluate(() => document.getElementById("cartOpen").click()); await p.click("#checkoutButton");
  return p;
}
for (const lang of ["en", "ar"]) for (const vp of [{ width: 390, height: 664 }, { width: 360, height: 560 }]) {
  const p = await openSheet(lang, vp); const tag = `${lang} ${vp.width}x${vp.height}`;
  if (await p.locator("#pickupMore").count()) await p.click("#pickupMore"); // longest sheet: every slot shown
  const sc = await p.evaluate(() => { const el = document.querySelector(".checkout-panel"); return { sh: el.scrollHeight, ch: el.clientHeight, oy: getComputedStyle(el).overflowY }; });
  ok(sc.sh > sc.ch && sc.oy === "auto", `${tag}: the sheet is taller than the screen and scrolls inside itself (${sc.sh} > ${sc.ch})`);
  ok(await inView(p, "#placeDemoOrder"), `${tag}: completion button reachable without scrolling (pinned at the bottom)`);
  await p.evaluate(() => { const el = document.querySelector(".checkout-panel"); el.scrollTop = el.scrollHeight; });
  ok(await inView(p, "#modalClose") && await inView(p, "#placeDemoOrder"), `${tag}: scrolled to the end, × and the button are both on screen`);
  await p.click("#placeDemoOrder");
  ok(/Nothing was sent|لم يُرسل شيء/.test(await p.textContent("#checkoutMessage")), `${tag}: the preview completes`);
  await p.close();
}
{ // desktop: no regression, the panel fits and does not scroll
  const p = await openSheet("en", { width: 1280, height: 900 });
  const sc = await p.evaluate(() => { const el = document.querySelector(".checkout-panel"); return el.scrollHeight <= el.clientHeight + 1; });
  ok(sc && await inView(p, "#placeDemoOrder"), "desktop 1280x900: sheet fits, button in view"); await p.close();
}
{ // F-CHK-2: HST 13% as its own line, drawer and sheet, EN/FR/AR; 2×24.99 + 5.99 + 2×3.99 = 63.95 -> HST 8.31 (8.3135 half-up) -> 72.26
  for (const [lang, hst, re] of [["en", "HST (13%)", /72\.26/], ["fr", "TVH (13 %)", /72,26/], ["ar", "ضريبة المبيعات (13%)", /72\.26/]]) {
    const p = await openSheet(lang, { width: 390, height: 844 });
    const sheet = await p.textContent("#checkoutTotals");
    ok(sheet.includes(hst) && /63[.,]95/.test(sheet) && /8[.,]31/.test(sheet) && re.test(sheet), `${lang}: sheet shows subtotal 63.95, ${hst} 8.31, total 72.26`);
    await p.click("#modalClose"); await p.evaluate(() => document.getElementById("cartOpen").click());
    ok(/8[.,]31/.test(await p.textContent("#cartTax")) && re.test(await p.textContent("#cartGrand")), `${lang}: drawer shows the same HST and total`);
    await p.close();
  }
}
{ // F-WALK-1 + F-WALK-2: the preview keeps the tray; the chosen time survives close and reopen
  const p = await openSheet("en", { width: 390, height: 844 });
  if (await p.locator("#pickupMore").count()) await p.click("#pickupMore");
  const pick = await p.evaluate(() => { const r = [...document.querySelectorAll('input[name="pickup"]')]; const x = r[r.length - 2]; x.click(); return x.value; });
  await p.click("#modalClose"); await p.evaluate(() => document.getElementById("cartOpen").click()); await p.click("#checkoutButton");
  ok(await p.evaluate((v) => document.querySelector(`input[name="pickup"][value="${v}"]`)?.checked === true, pick), "F-WALK-2: the chosen pickup time is still selected after close + reopen");
  await p.click("#placeDemoOrder");
  ok(JSON.stringify(await p.evaluate(() => [...cart.entries()])) === "[[1,2],[6,1],[8,2]]", "F-WALK-1: the preview leaves the tray intact");
  ok(await p.evaluate(() => localStorage.getItem("azal-pickup-v1")) === null, "the pickup choice is not stored (the sheet says nothing is stored)");
  await p.close();
}
await b.close(); srv.close(); console.log(fails ? `${fails} failed` : "all passed"); process.exit(fails ? 1 : 0);
