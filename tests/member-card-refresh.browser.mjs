// T-23B (vote V-1 + V-2, adopted 2-0): the balance is on the membership card (once: the stats line folds into it), with
// the next reward by checkout's redeemView rule; it refreshes itself on returning to the tab and when the member's order
// is collected, re-reading the same auth.state(), patching only the numbers. FAKE Supabase.
// Run: node tests/member-card-refresh.browser.mjs
import { createRequire } from "node:module"; import http from "node:http"; import { readFileSync, existsSync } from "node:fs"; import { join, extname } from "node:path";
import { nullConfig } from "./null-config.mjs";
const require = createRequire(process.env.NODE_PATH ? join(process.env.NODE_PATH, "x") : import.meta.url); const { chromium } = require("playwright");
const root = new URL("..", import.meta.url).pathname; const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2" };
const srv = http.createServer((q, r) => { const p = join(root, decodeURIComponent(q.url.split("?")[0])); if (!existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": T[extname(p)] || "application/octet-stream" }); r.end(readFileSync(p)); }).listen(0);
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
const b = nullConfig(await chromium.launch()); const base = `http://localhost:${srv.address().port}`;
async function open({ lang = "en", w = 390, options = true } = {}) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } }); const srvState = { points: 2824, hold: null, ledgerCalls: 0 };
  await p.route("**/supabase-config.js*", (r) => r.fulfill({ contentType: "text/javascript", body: 'window.AZAL_SUPABASE=Object.freeze({url:"https://fake.supabase.co",anonKey:"anon"});' }));
  await p.route("https://fake.supabase.co/**", async (r) => { const u = decodeURIComponent(r.request().url());
    if (u.includes("/rest/v1/profiles")) return r.fulfill({ json: [{ id: "u1", display_name: "Aziz", phone: "+16135550180", member_number: 10001, created_at: "2026-11-20T15:00:00Z" }] });
    if (u.includes("/rest/v1/points_ledger")) { srvState.ledgerCalls++; if (srvState.hold) await srvState.hold; return r.fulfill({ json: [{ delta_points: srvState.points }] }); }
    if (u.endsWith("/rpc/redeem_options")) return options ? r.fulfill({ json: { balance: srvState.points, step_points: 10000, cents_per_step: 1000, max_steps: 20 } }) : r.fulfill({ status: 404, json: {} });
    if (u.includes("/auth/v1/logout")) return r.fulfill({ status: 204, body: "" });
    if (u.includes("/rpc/azal_is_admin")) return r.fulfill({ json: false });
    if (u.includes("/rest/v1/memberships")) return r.fulfill({ json: [{ status: "active" }] });
    if (u.includes("/rest/v1/user_roles") || u.includes("/rest/v1/orders")) return r.fulfill({ json: [] });
    return r.fulfill({ status: 404, json: {} }); });
  await p.addInitScript((l) => { localStorage.setItem("azal-language", l); if (!sessionStorage.getItem("s")) { sessionStorage.setItem("s", "1"); localStorage.setItem("azal-auth-v1", JSON.stringify({ access_token: "T", refresh_token: "R", expires_at: 4e12, user: { id: "u1", email: "aziz@example.invalid" } })); } }, lang);
  await p.goto(base + "/member.html"); await p.waitForSelector(".mcard"); await p.waitForTimeout(400);
  return { p, srvState };
}
const back = (p) => p.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
{ const { p, srvState } = await open();
  ok(/Points\s*2,824/.test(await p.textContent("#authCardPoints")), "V-1: the balance is on the card");
  ok(await p.textContent("#authCardNext") === "7,176 more points to $10.00 off", "V-1: the next reward by the redeemView rule (10,000 = $10)");
  ok(await p.locator(".member-stat-points").count() === 0 && (await p.innerText(".member-card")).match(/2,824/g).length === 1, "V-1: points presented once (the stats line folds into the card)");
  srvState.points = 12824; await back(p); await p.waitForTimeout(500);
  ok(/12,824/.test(await p.textContent("#authCardPoints")) && await p.textContent("#authCardNext") === "7,176 more points to $20.00 off", "V-2: back on the tab, the balance and the next reward refresh themselves");
  const n = srvState.ledgerCalls; await back(p); await p.evaluate(() => window.dispatchEvent(new Event("focus"))); await p.waitForTimeout(400);
  ok(srvState.ledgerCalls === n, "V-2: no request storm (one re-read per 15 s from focus/visibility)");
  srvState.points = 20824; await p.evaluate(() => document.dispatchEvent(new CustomEvent("azal:order-collected"))); await p.waitForTimeout(500);
  ok(/20,824/.test(await p.textContent("#authCardPoints")) && /9,176 more points to \$30\.00 off/.test(await p.textContent("#authCardNext")), "V-2: an order collected refreshes it at once");
  await p.click("#authEditDetails"); await p.fill("#pfName", "Aziz typing");
  srvState.points = 21000; await p.evaluate(() => document.dispatchEvent(new CustomEvent("azal:order-collected"))); await p.waitForTimeout(500);
  ok(await p.inputValue("#pfName") === "Aziz typing" && /21,000/.test(await p.textContent("#authCardPoints")), "V-2: only the numbers are patched; an open details form keeps what was typed");
  await p.close(); }
{ // a refresh still in flight when the member signs out is dropped (ChatGPT's guard condition)
  const { p, srvState } = await open();
  let release; srvState.hold = new Promise((r) => (release = r)); srvState.points = 99999;
  await p.evaluate(() => document.dispatchEvent(new CustomEvent("azal:order-collected"))); await p.waitForTimeout(150);
  await p.click("#authSignOut"); await p.waitForTimeout(300); release(); srvState.hold = null; await p.waitForTimeout(500);
  ok(await p.locator("#authForm").count() === 1 && await p.locator(".mcard").count() === 0 && !/99,999/.test(await p.textContent("main")), "a late answer after sign-out never repaints the account");
  await p.close(); }
{ const { p } = await open({ options: false });
  ok(/2,824/.test(await p.textContent("#authCardPoints")) && await p.locator("#authCardNext").isHidden(), "no rewards info from the server: the balance shows, no next line (nothing invented)");
  await p.close(); }
for (const [lang, w, re] of [["ar", 320, /باقي 7,176 نقطة على خصم\u00a0\u2066/], ["fr", 390, /Encore 7\s176 points pour 10,00\s\$ de rabais/]]) {
  const { p } = await open({ lang, w });
  ok(re.test(await p.textContent("#authCardNext")) && await p.evaluate(() => { const r = document.querySelector(".mcard").getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && document.documentElement.scrollWidth <= innerWidth; }), `${lang} @${w}: the next-reward line in ${lang} (amount isolated in Arabic), the card fits`);
  await p.close(); }
await b.close(); srv.close(); if (fails) { console.log(fails + " failed"); process.exit(1); } else console.log("all passed");
