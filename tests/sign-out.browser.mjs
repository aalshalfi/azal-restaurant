// T-01 / F-OWN-19 / Journey J9: sign-out on every authenticated surface. FAKE Supabase.
// admin.html and staff.html show identity + a labelled sign-out (EN/FR/AR); clicking it calls the server logout,
// removes the local session key, drops the page's data, and lands on member.html signed out; a later visit to the
// shell shows the signed-out state. The member page's own sign-out is verified in the same pass.
// Run: node tests/sign-out.browser.mjs
import { createRequire } from "node:module"; import http from "node:http"; import { readFileSync, existsSync } from "node:fs"; import { join, extname } from "node:path";
import { nullConfig } from "./null-config.mjs";
const require = createRequire(process.env.NODE_PATH ? join(process.env.NODE_PATH, "x") : import.meta.url); const { chromium } = require("playwright");
const root = new URL("..", import.meta.url).pathname; const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2" };
const srv = http.createServer((q, r) => { const p = join(root, decodeURIComponent(q.url.split("?")[0])); if (!existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": T[extname(p)] || "application/octet-stream" }); r.end(readFileSync(p)); }).listen(0);
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
const b = nullConfig(await chromium.launch()); const base = `http://localhost:${srv.address().port}`;
const KEY = "azal-auth-v1";

async function ctxFor(role, lang = "en", w = 390) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 } }); const sent = [];
  await ctx.route("**/supabase-config.js*", (r) => r.fulfill({ contentType: "text/javascript", body: 'window.AZAL_SUPABASE=Object.freeze({url:"https://fake.supabase.co",anonKey:"anon"});' }));
  await ctx.route("https://fake.supabase.co/**", (r) => {
    const u = decodeURIComponent(r.request().url()); sent.push(u);
    if (u.includes("/auth/v1/logout")) return r.fulfill({ status: 204, body: "" });
    if (u.includes("/rpc/azal_is_admin")) return r.fulfill({ json: role === "admin" });
    if (u.includes("/rpc/azal_staff_can_access")) return r.fulfill({ json: role === "admin" || role === "staff" });
    if (u.includes("/rest/v1/user_roles")) return r.fulfill({ json: role === "customer" ? [] : [{ role }] });
    if (u.includes("/rest/v1/staff_branch_access")) return r.fulfill({ json: [] });
    if (u.includes("/rest/v1/orders")) return r.fulfill({ json: role === "customer" ? [] : [{ id: "abc12300-0000-4000-8000-000000000001", branch_slug: "ottawa", fulfilment_status: "placed", payment_status: "paid", total_cents: 2824, pickup_slot: "2026-11-27T22:30:00Z", order_items: [{ quantity: 1, item_name_en_snapshot: "Lamb Mandi" }], guest_name: "Guest" }] });
    if (u.includes("/rest/v1/memberships")) return r.fulfill({ json: [{ status: "active" }], headers: { "content-range": "0-0/3", "access-control-expose-headers": "content-range" } });
    if (u.includes("/rest/v1/profiles")) return r.fulfill({ json: [{ id: "u1", display_name: "Owner", phone: null }] });
    if (u.includes("/rest/v1/points_ledger")) return r.fulfill({ json: [] });
    if (u.includes("claim_guest_points")) return r.fulfill({ json: { points_added: 0 } });
    return r.fulfill({ status: 404, json: {} });
  });
  await ctx.addInitScript(([l, k]) => { localStorage.setItem("azal-language", l); if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem(k, JSON.stringify({ access_token: "T", refresh_token: "R", expires_at: 4e12, user: { id: "u1", email: "info@example.invalid" } })); } }, [lang, KEY]);
  return { ctx, sent };
}

for (const [pg, role, btn, data] of [["admin", "admin", "#adminSignOut", /Collected sales today/], ["staff", "staff", "#staffSignOut", /Lamb Mandi/]]) {
  const { ctx, sent } = await ctxFor(role); const p = await ctx.newPage();
  await p.goto(`${base}/${pg}.html`); await p.waitForTimeout(600);
  ok(await p.locator(btn).isVisible() && /Sign out/.test(await p.textContent(btn)) && /info@example\.invalid/.test(await p.textContent("main")), `${pg}: identity line and a labelled Sign out control`);
  ok(data.test(await p.textContent("main")), `${pg}: shows its data before signing out`);
  await p.click(btn); await p.waitForURL(/member\.html$/, { timeout: 5000 }).catch(() => {});
  ok(/member\.html$/.test(p.url()), `${pg}: sign-out lands on the member page`);
  ok(sent.some((u) => u.includes("/auth/v1/logout")), `${pg}: the server session is ended (logout call)`);
  ok(await p.evaluate((k) => localStorage.getItem(k) === null, KEY), `${pg}: the local session key is gone`);
  await p.waitForTimeout(400);
  ok(await p.locator("#authForm").count() === 1, `${pg}: the member page shows the sign-in form (signed out)`);
  await p.goto(`${base}/${pg}.html`); await p.waitForTimeout(500);
  ok(/Sign in/.test(await p.textContent("main")) && !data.test(await p.textContent("main")) && await p.locator(btn).count() === 0, `${pg}: visiting again shows the signed-out state, no data`);
  await ctx.close();
}
{ // the member page's own sign-out, same pass
  const { ctx, sent } = await ctxFor("customer"); const p = await ctx.newPage();
  await p.goto(`${base}/member.html`); await p.waitForSelector("#authSignOut", { timeout: 5000 }).catch(() => {});
  await p.click("#authSignOut"); await p.waitForTimeout(500);
  ok(sent.some((u) => u.includes("/auth/v1/logout")) && await p.evaluate((k) => localStorage.getItem(k) === null, KEY) && await p.locator("#authForm").count() === 1, "member: sign-out ends the session, clears the key, shows the sign-in form");
  await ctx.close();
}
for (const [lang, word] of [["fr", /Se déconnecter/], ["ar", /تسجيل الخروج/]]) for (const [pg, role, btn] of [["admin", "admin", "#adminSignOut"], ["staff", "staff", "#staffSignOut"]]) {
  const { ctx } = await ctxFor(role, lang, 320); const p = await ctx.newPage();
  await p.goto(`${base}/${pg}.html`); await p.waitForTimeout(600);
  ok(word.test(await p.textContent(btn)) && await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${lang} ${pg} @320: labelled control, no horizontal scroll`);
  await ctx.close();
}
await b.close(); srv.close(); if (fails) { console.log(fails + " failed"); process.exit(1); } else console.log("all passed");
