// #30 (ChatGPT review, lead-confirmed): the default Supabase email carries a sign-in LINK only, so the page must not promise
// a code. With a fake Supabase: request -> "we emailed a sign-in link", no code box; with emailCode:true the code box shows.
// Run: node tests/auth-link.browser.mjs
import { createRequire } from "node:module"; import http from "node:http"; import { readFileSync, existsSync } from "node:fs"; import { join, extname } from "node:path";
import { nullConfig } from "./null-config.mjs";
const require = createRequire(process.env.NODE_PATH ? join(process.env.NODE_PATH, "x") : import.meta.url); const { chromium } = require("playwright");
const root = new URL("..", import.meta.url).pathname; const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff": "font/woff" };
const srv = http.createServer((q, r) => { const p = join(root, decodeURIComponent(q.url.split("?")[0])); if (!existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": T[extname(p)] || "application/octet-stream" }); r.end(readFileSync(p)); }).listen(0);
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
const b = nullConfig(await chromium.launch()); const base = `http://localhost:${srv.address().port}`;
async function run(lang, emailCode) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.addInitScript((l) => localStorage.setItem("azal-language", l), lang);
  await p.route("**/supabase-config.js*", (r) => r.fulfill({ contentType: "text/javascript", body: `window.AZAL_SUPABASE=Object.freeze({url:"https://fake.supabase.co",anonKey:"anon"${emailCode ? ",emailCode:true" : ""}});` }));
  await p.route("https://fake.supabase.co/**", (r) => r.request().url().includes("/auth/v1/otp") ? r.fulfill({ json: {} }) : r.fulfill({ status: 401, json: {} }));
  await p.goto(`${base}/member.html`); await p.waitForSelector("#authForm"); // F-OWN-1: password first; the link is one tap away
  await p.click("#authUseCode"); await p.waitForSelector("#authCodeRequest");
  const btn = await p.textContent("#authSubmit");
  await p.fill("#authEmail", "guest@example.invalid"); await p.click("#authSubmit"); await p.waitForSelector(".auth-sent");
  const r = { btn, sent: await p.textContent(".auth-sent"), box: await p.locator("#authCode").count(), card: await p.textContent(".member-card") };
  await p.close(); return r;
}
for (const [lang, btnRe, sentRe] of [["en", /sign-in link/, /sign-in link to guest@example\.invalid/], ["fr", /lien de connexion/, /lien de connexion à guest@example\.invalid/], ["ar", /رابط الدخول/, /رابط الدخول إلى guest@example\.invalid/]]) {
  const r = await run(lang, false);
  ok(btnRe.test(r.btn) && sentRe.test(r.sent), `${lang}: link-first wording ("${r.sent.slice(0, 50)}…")`);
  ok(r.box === 0 && !/\bcode\b|Saisissez le code|اكتب الرمز/i.test(r.card), `${lang}: no code box and no promise of a code`);
}
{ const r = await run("en", true); ok(r.box === 1 && /Enter the code below/.test(r.sent), "with emailCode:true (template carries the token) the code box returns"); }
await b.close(); srv.close(); console.log(fails ? `${fails} failed` : "all passed"); process.exit(fails ? 1 : 0);
