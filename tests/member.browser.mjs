// Member page before sign-ups open (owner 21:30/21:31): one honest state in every language, no "your" cards, no points
// shell, no dead buttons; the one action is a real link. Run: node tests/member.browser.mjs
import { createRequire } from "node:module"; import http from "node:http"; import { readFileSync, existsSync } from "node:fs"; import { join, extname } from "node:path";
const require = createRequire(process.env.NODE_PATH ? join(process.env.NODE_PATH, "x") : import.meta.url); const { chromium } = require("playwright");
const root = new URL("..", import.meta.url).pathname; const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff": "font/woff" };
const srv = http.createServer((q, r) => { const p = join(root, decodeURIComponent(q.url.split("?")[0])); if (!existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": T[extname(p)] || "application/octet-stream" }); r.end(readFileSync(p)); }).listen(0);
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
const b = await chromium.launch(); const base = `http://localhost:${srv.address().port}`;
const TITLE = { en: "The Majlis opens its doors soon.", fr: "Le Majlis ouvre bientôt ses portes.", ar: "باب المجلس يُفتح قريباً." };
for (const lang of ["en", "fr", "ar"]) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.addInitScript((l) => localStorage.setItem("azal-language", l), lang);
  await p.goto(`${base}/member.html`);
  const s = await p.evaluate(() => { const m = document.querySelector("main"); return { title: m.querySelector(".member-card h2")?.textContent, text: m.innerText, dead: m.querySelectorAll("button[disabled]").length, buttons: m.querySelectorAll("button").length, link: m.querySelector(".member-card a.button")?.getAttribute("href") }; });
  ok(s.title === TITLE[lang], `${lang}: one clear state, titled "${s.title}"`);
  ok(s.dead === 0 && s.buttons === 0 && s.link === "menu.html", `${lang}: no dead or pseudo buttons; the action is a real link to the menu`);
  ok(!/—/.test(s.text), `${lang}: no placeholder dash where points would be`);
  await p.click(".member-card a.button"); await p.waitForURL(/menu\.html/);
  ok(true, `${lang}: the link works`); await p.close();
}
await b.close(); srv.close(); console.log(fails ? `${fails} failed` : "all passed"); process.exit(fails ? 1 : 0);
