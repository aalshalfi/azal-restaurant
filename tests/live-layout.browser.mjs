// Activation layout (3251974 filled supabase-config.js): with a LIVE-shaped config the member page shows the
// sign-in form. Arabic at 320px overflowed by 20px: the email input's intrinsic width (Arabic font) widened the card.
// Every page, three languages, 320/390: no horizontal scroll with a live-shaped config. Network to Supabase is aborted.
// Run: node tests/live-layout.browser.mjs
import { createRequire } from "node:module"; import http from "node:http"; import { readFileSync, existsSync } from "node:fs"; import { join, extname } from "node:path";
const require = createRequire(process.env.NODE_PATH ? join(process.env.NODE_PATH, "x") : import.meta.url); const { chromium } = require("playwright");
const root = new URL("..", import.meta.url).pathname; const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2" };
const srv = http.createServer((q, r) => { const p = join(root, decodeURIComponent(q.url.split("?")[0]).replace(/^\/azal-restaurant\//, "/")); if (!existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": T[extname(p)] || "application/octet-stream" }); r.end(readFileSync(p)); }).listen(0);
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
const b = await chromium.launch(); const base = `http://localhost:${srv.address().port}`;
for (const lang of ["en", "fr", "ar"]) for (const pg of ["index", "menu", "member", "reserve", "story", "404"]) for (const w of [320, 390]) {
  const p = await b.newPage({ viewport: { width: w, height: 760 } });
  await p.route("**/supabase-config.js*", (r) => r.fulfill({ contentType: "text/javascript", body: 'window.AZAL_SUPABASE=Object.freeze({url:"https://fake.supabase.co",anonKey:"sb_publishable_test"});' }));
  await p.route("https://fake.supabase.co/**", (r) => r.abort());
  await p.addInitScript((l) => localStorage.setItem("azal-language", l), lang);
  await p.goto(`${base}/${pg}.html`); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(200);
  const d = await p.evaluate(() => ({ ovf: document.documentElement.scrollWidth - innerWidth, form: !!document.querySelector("#authEmail") }));
  ok(d.ovf <= 0 && (pg !== "member" || d.form), `${lang} ${pg} @${w}: no horizontal scroll (${d.ovf}px)${pg === "member" ? ", sign-in form shown" : ""}`);
  await p.close();
}
await b.close(); srv.close(); if (fails) { console.log(fails + " failed"); process.exit(1); }
