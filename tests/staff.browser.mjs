// Browser check for the kitchen screen with a FAKE Supabase. Run: node tests/staff.browser.mjs
import { createRequire } from "node:module"; import http from "node:http"; import { readFileSync, existsSync } from "node:fs"; import { join, extname } from "node:path";
const require = createRequire(process.env.NODE_PATH ? join(process.env.NODE_PATH, "x") : import.meta.url); const { chromium } = require("playwright");
const root = new URL("..", import.meta.url).pathname; const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };
const srv = http.createServer((q, r) => { const p = join(root, decodeURIComponent(q.url.split("?")[0])); if (!existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": T[extname(p)] || "application/octet-stream" }); r.end(readFileSync(p)); }).listen(0);
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
const b = await chromium.launch(); const port = srv.address().port;
async function open({ staff = true, session = true }) {
  const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  const orders = [
    { id: "aaaaaa11-0000-4000-8000-000000000001", pickup_slot: "2026-11-26T17:15:00Z", guest_name: "Sara", customer_note: "Less spice", fulfilment_status: "placed", total_cents: 6325, order_items: [{ quantity: 2, item_name_en_snapshot: "Lamb Mandi", item_name_fr_snapshot: "Mandi d’agneau" }] },
    { id: "bbbbbb22-0000-4000-8000-000000000002", pickup_slot: "2026-11-26T17:15:00Z", guest_name: null, customer_note: null, fulfilment_status: "ready", total_cents: 451, order_items: [{ quantity: 1, item_name_en_snapshot: "Adeni Chai", item_name_fr_snapshot: "Thé adéni" }] }
  ];
  const acts = [];
  await page.route("**/supabase-config.js*", (r) => r.fulfill({ contentType: "text/javascript", body: 'window.AZAL_SUPABASE=Object.freeze({url:"https://fake.supabase.co",anonKey:"anon"});' }));
  await page.route("https://fake.supabase.co/**", async (r) => {
    const u = r.request().url();
    if (u.includes("azal_staff_can_access")) return r.fulfill({ json: staff });
    if (u.includes("/rest/v1/orders")) return r.fulfill({ json: orders.filter((o) => !["handed_over", "cancelled"].includes(o.fulfilment_status)) });
    if (u.includes("staff_update_order")) { const bd = r.request().postDataJSON(); acts.push(bd); const o = orders.find((x) => x.id === bd.p_order); o.fulfilment_status = { accept: "accepted", ready: "ready", hand_over: "handed_over" }[bd.p_action]; return r.fulfill({ json: { order_id: o.id, fulfilment_status: o.fulfilment_status } }); }
    if (u.includes("/auth/v1/")) return r.fulfill({ status: 401, json: {} });
    return r.fulfill({ status: 404, json: {} });
  });
  if (session) await page.addInitScript(() => localStorage.setItem("azal-auth-v1", JSON.stringify({ access_token: "STAFF", refresh_token: "R", expires_at: 4e12, user: { id: "s1", email: "staff@example.invalid" } })));
  await page.goto(`http://localhost:${port}/staff.html`);
  return { page, acts };
}
{
  const { page, acts } = await open({});
  await page.waitForSelector(".staff-order");
  ok(await page.locator(".staff-slot").count() === 1 && await page.locator(".staff-order").count() === 2, "two paid orders grouped under one pickup slot");
  ok(/AAAAAA/.test(await page.textContent(".staff-order.is-placed .staff-code")) && /Less spice/.test(await page.textContent(".staff-order.is-placed")), "code, guest name and kitchen note shown");
  ok(/Member/.test(await page.textContent(".staff-order.is-ready .staff-who")), "member order without guest name says Member");
  await page.click(".staff-order.is-placed .staff-act"); await page.waitForFunction(() => /Ready/.test(document.querySelector(".staff-order.is-accepted .staff-act")?.textContent || ""));
  await page.click(".staff-order.is-accepted .staff-act"); await page.waitForFunction(() => document.querySelectorAll(".staff-order.is-ready").length === 2);
  await page.click(".staff-order.is-ready >> nth=0 >> .staff-act"); await page.waitForFunction(() => document.querySelectorAll(".staff-order").length === 1);
  ok(JSON.stringify(acts.map((a) => a.p_action)) === '["accept","ready","hand_over"]', "Accept -> Ready -> Hand over, each through staff_update_order");
  await page.screenshot({ path: process.env.SHOT || "/tmp/staff.png" });
  await page.close();
}
{ const { page } = await open({ staff: false }); await page.waitForSelector(".staff-note"); ok(/not set up as staff/.test(await page.textContent("#staffRoot")), "non-staff account sees a clear message, no orders"); await page.close(); }
{ const { page } = await open({ session: false }); await page.waitForSelector("a[href='member.html'].button"); ok(true, "signed out: sent to sign-in"); await page.close(); }
{ const page = await b.newPage(); await page.goto(`http://localhost:${port}/staff.html`); await page.waitForTimeout(300); ok(/turns on when the site is connected/.test(await page.textContent("#staffRoot")), "inert with shipped null config"); await page.close(); }
await b.close(); srv.close(); console.log(fails ? `${fails} failed` : "all passed"); process.exit(fails ? 1 : 0);
