// T-23 step 2: the member page shows the membership number (0013) and never shows the join pitch to a signed-in member
// (F-OWN-17, owner re-flag 20:20). Visitors keep the pitch. A server without 0013 shows no number and still works.
// FAKE Supabase. Run: node tests/member-number.browser.mjs
import { createRequire } from "node:module"; import http from "node:http"; import { readFileSync, existsSync } from "node:fs"; import { join, extname } from "node:path";
import { nullConfig } from "./null-config.mjs";
const require = createRequire(process.env.NODE_PATH ? join(process.env.NODE_PATH, "x") : import.meta.url); const { chromium } = require("playwright");
const root = new URL("..", import.meta.url).pathname; const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2" };
const srv = http.createServer((q, r) => { const p = join(root, decodeURIComponent(q.url.split("?")[0])); if (!existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": T[extname(p)] || "application/octet-stream" }); r.end(readFileSync(p)); }).listen(0);
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
const b = nullConfig(await chromium.launch()); const base = `http://localhost:${srv.address().port}`;
async function open({ signedIn = true, lang = "en", w = 390, server = "0013" } = {}) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } }); const asked = [];
  await p.route("**/supabase-config.js*", (r) => r.fulfill({ contentType: "text/javascript", body: 'window.AZAL_SUPABASE=Object.freeze({url:"https://fake.supabase.co",anonKey:"anon"});' }));
  await p.route("https://fake.supabase.co/**", (r) => { const u = decodeURIComponent(r.request().url());
    if (u.includes("/rest/v1/profiles")) { asked.push(u);
      if (u.includes("member_number") && server !== "0013") return r.fulfill({ status: 400, json: { code: "42703", message: "column profiles.member_number does not exist" } });
      return r.fulfill({ json: [{ id: "u1", display_name: "Aziz", phone: "+16135550180", ...(u.includes("member_number") ? { member_number: 10001 } : {}) }] }); }
    if (u.includes("/rpc/azal_is_admin")) return r.fulfill({ json: false });
    if (u.includes("/rest/v1/user_roles")) return r.fulfill({ json: [] });
    if (u.includes("/rest/v1/memberships")) return r.fulfill({ json: [{ status: "active", joined_at: "2026-11-20T15:00:00Z" }] });
    if (u.includes("/rest/v1/points_ledger")) return r.fulfill({ json: [{ delta_points: 2824 }] });
    if (u.includes("/rest/v1/orders")) return r.fulfill({ json: [] });
    return r.fulfill({ status: 404, json: {} }); });
  await p.addInitScript(([l, s]) => { localStorage.setItem("azal-language", l); if (s) localStorage.setItem("azal-auth-v1", JSON.stringify({ access_token: "T", refresh_token: "R", expires_at: 4e12, user: { id: "u1", email: "aziz@example.invalid" } })); }, [lang, signedIn]);
  await p.goto(base + "/member.html"); await p.waitForTimeout(700);
  return { p, asked };
}
{ const { p } = await open();
  ok(/Membership no\. 10001/.test((await p.textContent("#authMemberNo")).replace(/\s+/g, " ")), "signed in: the membership number is shown");
  ok(await p.locator(".member-banner").isHidden() && !/Be one of our regulars|Join with your email/.test(await p.innerText("main")), "signed in: the join pitch is gone (F-OWN-17)");
  ok(/Welcome|Aziz/.test(await p.textContent(".member-card")), "the account itself is shown");
  await p.close(); }
{ const { p } = await open({ signedIn: false });
  ok(await p.locator(".member-banner").isVisible() && /Be one of our regulars/.test(await p.textContent(".member-banner")) && await p.locator("#authMemberNo").count() === 0, "visitor: the pitch stays, no number");
  await p.close(); }
{ const { p, asked } = await open({ server: "pre0013" });
  ok(await p.locator("#authMemberNo").count() === 0 && /Aziz/.test(await p.textContent(".member-card")) && asked.length >= 2, "server without 0013: one step down, no number line, page works");
  ok(await p.locator(".member-banner").isHidden(), "…and the pitch is still hidden for the member");
  await p.close(); }
for (const [lang, w, word] of [["ar", 320, "رقم العضوية"], ["fr", 390, "N° de membre"], ["en", 1280, "Membership no."]]) {
  const { p } = await open({ lang, w });
  const t = await p.textContent("#authMemberNo");
  ok(t.includes(word) && t.includes("10001") && await p.getAttribute("#authMemberNo bdi", "dir") === "ltr" && await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${lang} @${w}: number line in ${lang}, digits left-to-right, no sideways scroll`);
  await p.close(); }
await b.close(); srv.close(); if (fails) { console.log(fails + " failed"); process.exit(1); } else console.log("all passed");
