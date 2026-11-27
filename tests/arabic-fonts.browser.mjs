// AR-TOFU (lead live QA 22:50): in Arabic, every element that shows Arabic text must have "AZAL Arabic" in its font
// stack, so no Latin-only stack (like the ritual title's serif) can render tofu boxes. Checks every page, plus the
// checkout preview's serving ritual. Run: node tests/arabic-fonts.browser.mjs
import { createRequire } from "node:module"; import http from "node:http"; import { readFileSync, existsSync } from "node:fs"; import { join, extname } from "node:path";
const require = createRequire(process.env.NODE_PATH ? join(process.env.NODE_PATH, "x") : import.meta.url); const { chromium } = require("playwright");
const root = new URL("..", import.meta.url).pathname; const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff": "font/woff" };
const srv = http.createServer((q, r) => { const p = join(root, decodeURIComponent(q.url.split("?")[0]).replace(/^\/azal-restaurant\//, "/")); if (!existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": T[extname(p)] || "application/octet-stream" }); r.end(readFileSync(p)); }).listen(0);
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
const b = await chromium.launch(); const base = `http://localhost:${srv.address().port}`;
const audit = () => { const bad = []; let n = 0;
  for (const el of document.querySelectorAll("body *")) {
    if (el.closest("svg,script,style") || !el.getClientRects().length) continue;
    const own = [...el.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent).join("");
    if (!/[؀-ۿ]/.test(own)) continue; n++;
    if (!getComputedStyle(el).fontFamily.includes("AZAL Arabic")) bad.push(el.tagName.toLowerCase() + "." + [...el.classList].join(".") + " → " + getComputedStyle(el).fontFamily.slice(0, 40));
  } return { n, bad: [...new Set(bad)] }; };
for (const pg of ["index", "menu", "story", "member", "reserve", "404"]) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } }); const woff = [];
  // ChatGPT #53 review: the family name alone is not proof; the WOFF must actually arrive and the face must load.
  p.on("response", (r) => { if (r.url().includes("Amiri-Arabic.woff")) woff.push(r.status()); });
  await p.addInitScript(() => { localStorage.setItem("azal-language", "ar"); localStorage.setItem("azal-demo-cart-v1", JSON.stringify([[1, 1], [4, 1], [8, 1]])); });
  await p.goto(`${base}/${pg}.html`);
  if (pg === "menu") { await p.evaluate(() => document.getElementById("cartOpen").click()); await p.click("#checkoutButton"); await p.click("#placeDemoOrder"); await p.waitForSelector(".ritual-title"); }
  const face = await p.evaluate(async () => { await document.fonts.ready; try { await document.fonts.load('400 20px "AZAL Arabic"', "سفرة"); } catch {} const f = [...document.fonts].filter((x) => x.family.replace(/"/g, "") === "AZAL Arabic"); return { faces: f.length, loaded: f.some((x) => x.status === "loaded"), check: document.fonts.check('400 20px "AZAL Arabic"', "سفرة") }; });
  ok(woff.includes(200) && face.loaded && face.check, `${pg}: the Arabic WOFF arrived (HTTP ${woff.join(",") || "none"}) and the "AZAL Arabic" face is loaded`);
  const r = await p.evaluate(audit);
  ok(r.n > 5 && r.bad.length === 0, `${pg}: all ${r.n} Arabic text elements carry "AZAL Arabic"` + (r.bad.length ? " — missing on: " + r.bad.join(" | ") : ""));
  if (pg === "menu") ok((await p.evaluate(() => getComputedStyle(document.querySelector(".ritual-title")).fontFamily)).startsWith('"AZAL Arabic"'), "menu: the serving-ritual title leads with AZAL Arabic (the tofu case)");
  await p.close();
}
await b.close(); srv.close(); console.log(fails ? `${fails} failed` : "all passed"); process.exit(fails ? 1 : 0);
