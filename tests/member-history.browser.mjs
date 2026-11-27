// Member page history with a FAKE Supabase. Run: node tests/member-history.browser.mjs
import { createRequire } from "node:module"; import http from "node:http"; import { readFileSync, existsSync } from "node:fs"; import { join, extname } from "node:path";
import { nullConfig } from "./null-config.mjs";
const require = createRequire(process.env.NODE_PATH ? join(process.env.NODE_PATH, "x") : import.meta.url); const { chromium } = require("playwright");
const root = new URL("..", import.meta.url).pathname; const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };
const srv = http.createServer((q, r) => { const p = join(root, decodeURIComponent(q.url.split("?")[0])); if (!existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": T[extname(p)] || "application/octet-stream" }); r.end(readFileSync(p)); }).listen(0);
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
const b = nullConfig(await chromium.launch()); const port = srv.address().port;
async function open({ lang = "en", signedIn = true, failOrders = false, extraEarns = 0 } = {}) {
  const page = await b.newPage({ viewport: { width: 390, height: 900 } }); const urls = [];
  await page.route("**/supabase-config.js*", (r) => r.fulfill({ contentType: "text/javascript", body: 'window.AZAL_SUPABASE=Object.freeze({url:"https://fake.supabase.co",anonKey:"anon"});' }));
  await page.route("https://fake.supabase.co/**", (r) => {
    const u = decodeURIComponent(r.request().url()); urls.push(u);
    if (u.includes("/rest/v1/orders")) return failOrders ? r.fulfill({ status: 500, json: {} }) : r.fulfill({ json: [
      { id: "abc12300-0000-4000-8000-000000000001", placed_at: "2026-11-25T17:00:00Z", pickup_slot: "2026-11-25T17:30:00Z", fulfilment_status: "handed_over", payment_status: "paid", total_cents: 6325, order_items: [{ quantity: 2, item_name_en_snapshot: "Lamb Mandi", item_name_fr_snapshot: "Mandi d’agneau" }, { quantity: 1, item_name_en_snapshot: "<img src=x onerror=window.__xss=1>", item_name_fr_snapshot: null }] },
      { id: "def45600-0000-4000-8000-000000000002", placed_at: "2026-11-26T15:00:00Z", pickup_slot: null, fulfilment_status: "placed", payment_status: "unpaid", total_cents: 451, order_items: [] } ] });
    if (u.includes("/rest/v1/points_ledger?select=id,entry_type")) return /offset=0/.test(u) ? r.fulfill({ json: [{ entry_type: "earn", delta_points: 559, created_at: "2026-11-25T18:00:00Z", order_id: "abc12300-0000-4000-8000-000000000001" }, ...Array.from({ length: extraEarns }, (_, i) => ({ entry_type: "earn", delta_points: 10, created_at: "2026-11-20T18:00:00Z", order_id: null }))] }) : r.fulfill({ json: [] });
    if (u.includes("/rest/v1/points_ledger")) return r.fulfill({ json: [{ delta_points: 559 }] });
    if (u.includes("/profiles")) return r.fulfill({ json: [{ id: "u1", display_name: null }] });
    if (u.includes("/memberships")) return r.fulfill({ json: [{ status: "active" }] });
    if (u.includes("claim_guest_points")) return r.fulfill({ json: { points_added: 0 } });
    return r.fulfill({ status: 404, json: {} });
  });
  await page.addInitScript(([l, s]) => { localStorage.setItem("azal-language", l); if (s) localStorage.setItem("azal-auth-v1", JSON.stringify({ access_token: "T", refresh_token: "R", expires_at: 4e12, user: { id: "u1", email: "m@example.com" } })); }, [lang, signedIn]);
  await page.goto(`http://localhost:${port}/member.html`);
  return { page, urls };
}
{
  const { page, urls } = await open();
  await page.waitForSelector("#memberHistory:not([hidden]) .mh-order");
  const t = await page.textContent("#memberHistory");
  ok(await page.locator(".mh-order").count() === 2 && /Code ABC123/.test(t) && /2× Lamb Mandi/.test(t), "orders listed newest-first data with code and items");
  ok(/Collected · Paid · Pickup/.test(t) && /Received · Not paid/.test(t), "status, payment and pickup time shown");
  ok(/Balance: 559 points/.test(t) && /Earned · order ABC123/.test(t) && /\+559/.test(t), "points balance and ledger row linked to the order code");
  ok(await page.evaluate(() => !window.__xss && !document.querySelector("#memberHistory img")) && /<img src=x/.test(t), "item name with markup rendered as text, no element, no script");
  ok(urls.filter((u) => /\/rest\/v1\/(orders|points_ledger\?select=entry_type)/.test(u)).every((u) => /user_id=eq\.u1/.test(u)), "every history request filtered to the member's own user_id");
  ok(await page.locator(".mh-cup").count() === 1 && /1 cup of qahwa poured for you/.test(t) && /Balance: 559 points/.test(t), "V3: one cup for one collected order, and the exact number still shown");
  await page.screenshot({ path: process.env.SHOT || "/tmp/member-history.png", fullPage: true });
  await page.close();
}
{ const { page } = await open({ extraEarns: 14 }); await page.waitForSelector(".mh-cups");
  ok(await page.locator(".mh-cup").count() === 12 && /\+3/.test(await page.textContent(".mh-cups")) && /15 cups/.test(await page.getAttribute(".mh-cups", "aria-label")), "V3: 15 orders -> 12 cups + '+3', full count in the accessible label"); await page.close(); }
{ const { page } = await open({ lang: "fr" }); await page.waitForSelector(".mh-order"); const t = await page.textContent("#memberHistory");
  ok(/Vos commandes/.test(t) && /Solde : 559 points/.test(t) && /2× Mandi d’agneau/.test(t) && /Récupérée · Payée/.test(t), "French labels and FR dish names"); await page.close(); }
{ const { page, urls } = await open({ signedIn: false }); await page.waitForTimeout(500);
  ok(await page.locator("#memberHistory").isHidden() && !urls.some((u) => /rest\/v1\/orders/.test(u)), "signed out: hidden, no orders request"); await page.close(); }
{ const { page } = await open({ failOrders: true }); await page.waitForSelector(".member-history-error");
  ok(true, "server error: clear message, no crash"); await page.close(); }
{ const page = await b.newPage(); await page.goto(`http://localhost:${port}/member.html`); await page.waitForTimeout(300);
  ok(await page.locator("#memberHistory").count() === 0, "inert with null config (demo mode)"); await page.close(); }
await b.close(); srv.close(); console.log(fails ? `${fails} failed` : "all passed"); process.exit(fails ? 1 : 0);
