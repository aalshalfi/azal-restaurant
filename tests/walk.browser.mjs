// Lead customer walk 22:05: F-WALK-3 (Arabic prices), F-WALK-5 (mood picker closes), F-WALK-7 (plurals, Arabic link).
// Run: node tests/walk.browser.mjs
import { createRequire } from "node:module"; import http from "node:http"; import { readFileSync, existsSync } from "node:fs"; import { join, extname } from "node:path";
const require = createRequire(process.env.NODE_PATH ? join(process.env.NODE_PATH, "x") : import.meta.url); const { chromium } = require("playwright");
const root = new URL("..", import.meta.url).pathname; const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff": "font/woff" };
const srv = http.createServer((q, r) => { const p = join(root, decodeURIComponent(q.url.split("?")[0])); if (!existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": T[extname(p)] || "application/octet-stream" }); r.end(readFileSync(p)); }).listen(0);
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
const b = await chromium.launch(); const base = `http://localhost:${srv.address().port}`;
async function page(lang, cart) { const p = await b.newPage({ viewport: { width: 390, height: 844 } }); await p.addInitScript(([l, c]) => { localStorage.setItem("azal-language", l); if (c) localStorage.setItem("azal-demo-cart-v1", JSON.stringify(c)); }, [lang, cart]); await p.goto(`${base}/menu.html`); return p; }
{ const p = await page("ar", [[1, 2]]);
  const s = await p.evaluate(() => [document.getElementById("stickyCartTotal").textContent, document.querySelector(".product-price").textContent, document.getElementById("cartTotal").textContent]);
  ok(s.every((x) => x.startsWith("⁦") && x.endsWith("⁩") && !x.includes("‏") && /\d+\.\d\d CA\$/.test(x)), "F-WALK-3: every Arabic price is a left-to-right isolate reading '49.98 CA$'");
  await p.close(); }
{ const p = await page("en"); await p.click("#sufra-guide > summary"); await p.click('#sufraCompass button[data-sufra-category="Rice"]');
  ok(await p.evaluate(() => !document.getElementById("sufra-guide").open) && /Mandi/.test(await p.textContent("#productGrid")), "F-WALK-5: picking a mood closes the picker and shows the dishes");
  await p.close(); }
for (const [lang, cart, re] of [["fr", [[1, 1]], /1 article\./], ["fr", [[1, 2]], /2 articles\./], ["en", [[1, 1]], /1 item\./], ["ar", [[1, 1]], /صنف واحد/], ["ar", [[1, 2]], /صنفان/], ["ar", [[1, 3]], /3 أصناف/], ["ar", [[1, 11]], /11 صنفاً/]]) {
  const p = await page(lang, cart); await p.evaluate(() => document.getElementById("cartOpen").click()); await p.click("#checkoutButton"); await p.click("#placeDemoOrder");
  const m = await p.textContent("#checkoutMessage"); ok(re.test(m) && !/\(s\)/.test(m), `F-WALK-7: ${lang} ${cart[0][1]} → ${re}`); await p.close();
}
{ const p = await b.newPage({ viewport: { width: 1280, height: 800 } }); await p.addInitScript(() => localStorage.setItem("azal-language", "ar")); await p.goto(`${base}/index.html`);
  const g = await p.evaluate(() => { const l = document.querySelector(".hero-actions .text-link"), cs = getComputedStyle(l); return [cs.borderBottomStyle, cs.textDecorationLine]; });
  ok(g[0] === "none" && g[1] === "underline", "F-WALK-7: Arabic hero link underline follows the text (no detached border)"); await p.close(); }
await b.close(); srv.close(); console.log(fails ? `${fails} failed` : "all passed"); process.exit(fails ? 1 : 0);
