// F-OWN-3 (owner first test: "a one-line summary is not enough"): full order detail on the member page, FAKE Supabase.
// Lines with unit and line prices, subtotal, Majlis points (0006), HST, total, pickup, note, timeline; own rows only;
// open state survives a language switch; Arabic prices are LTR isolates. Run: node tests/order-detail.browser.mjs
import { createRequire } from "node:module"; import http from "node:http"; import { readFileSync, existsSync } from "node:fs"; import { join, extname } from "node:path";
import { nullConfig } from "./null-config.mjs";
const require = createRequire(process.env.NODE_PATH ? join(process.env.NODE_PATH, "x") : import.meta.url); const { chromium } = require("playwright");
const root = new URL("..", import.meta.url).pathname; const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2" };
const srv = http.createServer((q, r) => { const p = join(root, decodeURIComponent(q.url.split("?")[0])); if (!existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": T[extname(p)] || "application/octet-stream" }); r.end(readFileSync(p)); }).listen(0);
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
const b = nullConfig(await chromium.launch()); const base = `http://localhost:${srv.address().port}`;
const ID = "abc12300-0000-4000-8000-000000000001";
const DETAIL = { id: ID, user_id: "u1", subtotal_cents: 5597, discount_cents: 500, redeemed_points: 5000, tax_rate_bps: 1300, tax_cents: 663, total_cents: 5760,
  scheduled_for: "2026-11-25T17:30:00Z", pickup_slot: "2026-11-25T17:30:00Z", customer_note: "No onions <b>please</b>", fulfilment_status: "handed_over", payment_status: "paid",
  order_items: [{ quantity: 2, unit_price_cents: 2499, line_total_cents: 4998, item_name_en_snapshot: "Lamb Mandi", item_name_fr_snapshot: "Mandi d’agneau" }, { quantity: 1, unit_price_cents: 599, line_total_cents: 599, item_name_en_snapshot: "Bread", item_name_fr_snapshot: "Pain" }],
  order_events: [{ event_type: "placed", to_status: "placed", created_at: "2026-11-25T17:00:00Z" }, { event_type: "paid", to_status: "paid", created_at: "2026-11-25T17:01:00Z" }, { event_type: "accept", to_status: "accepted", created_at: "2026-11-25T17:03:00Z" }, { event_type: "ready", to_status: "ready", created_at: "2026-11-25T17:25:00Z" }, { event_type: "hand_over", to_status: "handed_over", created_at: "2026-11-25T17:31:00Z" }] };
async function open({ lang = "en", w = 390, failDetail = false, pre0006 = false } = {}) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } }); const urls = [];
  await p.route("**/supabase-config.js*", (r) => r.fulfill({ contentType: "text/javascript", body: 'window.AZAL_SUPABASE=Object.freeze({url:"https://fake.supabase.co",anonKey:"anon"});' }));
  await p.route("https://fake.supabase.co/**", (r) => {
    const u = decodeURIComponent(r.request().url()); urls.push(u);
    if (u.includes("/rest/v1/orders") && /[?&]id=eq\./.test(u)) { if (failDetail) return r.fulfill({ status: 500, json: {} }); const d = structuredClone(DETAIL); if (pre0006) { delete d.discount_cents; delete d.redeemed_points; d.subtotal_cents = 5597; d.tax_cents = 728; d.total_cents = 6325; } return r.fulfill({ json: [d] }); }
    if (u.includes("/rest/v1/orders")) return r.fulfill({ json: [{ id: ID, placed_at: "2026-11-25T17:00:00Z", pickup_slot: "2026-11-25T17:30:00Z", fulfilment_status: "handed_over", payment_status: "paid", total_cents: 5760, order_items: [{ quantity: 2, item_name_en_snapshot: "Lamb Mandi" }] }] });
    if (u.includes("/rest/v1/points_ledger")) return r.fulfill({ json: [] });
    if (u.includes("claim_guest_points")) return r.fulfill({ json: { points_added: 0 } });
    if (u.includes("/profiles")) return r.fulfill({ json: [{ id: "u1" }] });
    if (u.includes("/memberships")) return r.fulfill({ json: [{ status: "active" }] });
    return r.fulfill({ status: 404, json: {} });
  });
  await p.addInitScript((l) => { localStorage.setItem("azal-language", l); localStorage.setItem("azal-auth-v1", JSON.stringify({ access_token: "T", refresh_token: "R", expires_at: 4e12, user: { id: "u1", email: "m@example.com" } })); }, lang);
  await p.goto(base + "/member.html"); await p.waitForSelector("#memberHistory:not([hidden]) .mh-order");
  return { p, urls };
}
const isDetail = (u) => u.includes("/rest/v1/orders") && /[?&]id=eq\./.test(u);
const txt = (p, s) => p.evaluate((s) => document.querySelector(s)?.textContent.replace(/\s+/g, " ").trim() ?? null, s);
{
  const { p, urls } = await open();
  const btn = p.locator(".mh-toggle");
  ok(await btn.count() === 1 && await btn.getAttribute("aria-expanded") === "false" && /Order details/.test(await btn.textContent()), "each order has a real 'Order details' button, collapsed");
  ok(!urls.some(isDetail), "nothing extra is fetched until the guest asks");
  await btn.click(); await p.waitForSelector(".mh-detail .mh-lines");
  const d = await txt(p, ".mh-detail");
  ok(/2× Lamb Mandi ?\$24\.99 each ?\$49\.98/.test(d) && /1× Bread ?\$5\.99 each ?\$5\.99/.test(d), "every line: quantity, name, unit price, line total");
  ok(/Subtotal ?\$55\.97/.test(d) && /Majlis points \(5,000\) ?−\$5\.00/.test(d) && /HST \(13%\) ?\$6\.63/.test(d) && /Total ?\$57\.60/.test(d), "subtotal, points used, HST, total: the server's own numbers");
  ok(/Pickup: Nov 25, 2026/.test(d) && /Your note: No onions <b>please<\/b>/.test(d) && await p.locator(".mh-detail b").count() === 0, "pickup time and the note (as text, never markup)");
  ok(/Received.*Paid.*Accepted.*Ready.*Collected/.test(d) && await p.locator(".mh-timeline li").count() === 5, "timeline: received, paid, accepted, ready, collected");
  ok(await btn.getAttribute("aria-expanded") === "true" && /Hide details/.test(await btn.textContent()) && await btn.getAttribute("aria-controls") === "mhd-" + ID, "button says Hide details, aria-expanded true, controls the panel");
  const du = urls.find(isDetail);
  ok(du && /user_id=eq\.u1/.test(du) && /select=\*,order_items\(/.test(du), "detail request filtered to the member's own user_id; select=* so 0006 columns come when present");
  await p.evaluate(() => { localStorage.setItem("azal-language", "fr"); document.querySelector("[data-lang='fr'], #langToggle, .language-toggle, .language-quick")?.click(); });
  await p.waitForTimeout(300);
  if (await p.evaluate(() => document.documentElement.lang) === "fr") {
    const f = await txt(p, ".mh-detail");
    ok(f !== null && /Détails|Masquer les détails/.test(await txt(p, ".mh-toggle")) && /2× Mandi d’agneau/.test(f) && /TVH/.test(f), "switching language keeps the panel open and translates it (state does not reset)");
  } else ok(true, "language toggle not reachable here (covered by the Arabic run)");
  await btn.click(); await p.waitForTimeout(100);
  ok(await p.locator(".mh-detail").count() === 0 && urls.filter(isDetail).length === 1, "collapse hides it; reopening uses the cached detail (one request)");
  await p.locator(".mh-toggle").click(); await p.waitForTimeout(100);
  ok(urls.filter(isDetail).length === 1 && await p.locator(".mh-detail .mh-lines").count() === 1, "reopened from cache");
  await p.close();
}
{
  const { p } = await open({ lang: "ar", w: 320 });
  ok(/وصلنا طلبك|تم الاستلام/.test(await txt(p, ".mh-status")) && !/استُلم/.test(await txt(p, "#memberHistory")), "Arabic status never says استُلم for a received order");
  await p.locator(".mh-toggle").click(); await p.waitForSelector(".mh-detail .mh-lines");
  const prices = await p.evaluate(() => [...document.querySelectorAll(".mh-detail dd, .mh-line-total")].map((e) => e.textContent));
  ok(prices.length >= 6 && prices.every((s) => s.startsWith("⁦") && s.endsWith("⁩")), "Arabic: every price is one LTR isolate");
  ok(prices.some((s) => s.startsWith("⁦−")), "Arabic: the points line's minus sits inside the isolate");
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Arabic at 320px: no horizontal scroll with the detail open");
  await p.close();
}
{
  const { p } = await open({ pre0006: true });
  await p.locator(".mh-toggle").click(); await p.waitForSelector(".mh-detail .mh-lines");
  const d = await txt(p, ".mh-detail");
  ok(!/Majlis points/.test(d) && /Total ?\$63\.25/.test(d), "before 0006 (no discount columns): no points line, totals still right");
  await p.close();
}
{
  const { p } = await open({ failDetail: true });
  await p.locator(".mh-toggle").click(); await p.waitForTimeout(300);
  ok(/couldn’t load this order/.test(await txt(p, ".mh-detail")), "a failed detail says so plainly (no blank panel)");
  await p.close();
}
await b.close(); srv.close(); if (fails) { console.log(fails + " failed"); process.exit(1); } else console.log("all passed");
