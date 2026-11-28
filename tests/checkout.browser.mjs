// Browser check for the live checkout with a FAKE Supabase (no network). Run: node tests/checkout.browser.mjs
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { nullConfig } from "./null-config.mjs";
const require = createRequire(process.env.NODE_PATH ? join(process.env.NODE_PATH, "x") : import.meta.url);
const { chromium } = require("playwright");
const root = new URL("..", import.meta.url).pathname;
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
const srv = http.createServer((q, r) => { const p = join(root, decodeURIComponent(q.url.split("?")[0])); if (!existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": types[extname(p)] || "application/octet-stream" }); r.end(readFileSync(p)); }).listen(0);
const port = srv.address().port;
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };

const browser = nullConfig(await chromium.launch());
async function run({ lang = "en", card, second }) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.clock.setFixedTime(new Date("2026-11-26T17:00:00Z")); // 12:00 Toronto
  const sent = [];
  await page.route("**/supabase-config.js*", (r) => r.fulfill({ contentType: "text/javascript", body: 'window.AZAL_SUPABASE=Object.freeze({url:"https://fake.supabase.co",anonKey:"anon-test"});' }));
  await page.route("https://fake.supabase.co/**", async (r) => {
    const u = r.request().url(), b = r.request().postDataJSON?.() ?? null; sent.push({ u, b });
    if (u.endsWith("/rpc/place_order")) return r.fulfill({ json: { order_id: "9f3c2a10-0000-4000-8000-000000000001", pickup_at: "2026-11-26T17:25:00Z", subtotal_cents: 5597, tax_cents: 728, total_cents: 6325, status: "placed", payment_status: "unpaid" } });
    if (u.endsWith("/rpc/pay_order_test")) { const paid = b.p_token === "tok_test_ok"; return r.fulfill({ json: { order_id: b.p_order, outcome: paid ? "paid" : "declined", reason: paid ? null : b.p_token === "tok_test_insufficient" ? "insufficient_funds" : "card_declined", total_cents: 6325 } }); }
    return r.fulfill({ status: 404, json: {} });
  });
  await page.addInitScript((l) => { localStorage.setItem("azal-demo-cart-v1", JSON.stringify([[1, 2], [6, 1]])); localStorage.setItem("azal-language", l); }, lang);
  await page.goto(`http://localhost:${port}/menu.html`);
  if (lang === "fr") { const fr = page.locator("[data-lang='fr'], #langToggle, .lang-toggle").first(); if (await page.evaluate(() => document.documentElement.lang) !== "fr" && await fr.count()) await fr.click(); }
  await page.evaluate(() => { document.getElementById("cartButton")?.click(); });
  await page.evaluate(() => document.getElementById("checkoutButton").click());
  await page.waitForSelector("#placeOrder", { state: "attached" }); await page.waitForTimeout(300); if (typeof choose === "undefined" || choose) { if (await page.locator("#coWhoGuest").isVisible()) await page.click("#coWhoGuest"); } // F-OWN-20 chooser
  return { page, sent };
}

{ // F-CHK-1 in live (test-mode) ordering: at a short phone height the sheet scrolls and #placeOrder stays reachable
  const { page } = await run({}); await page.setViewportSize({ width: 390, height: 600 });
  const r = await page.evaluate(() => { const el = document.querySelector(".checkout-panel"), b = document.getElementById("placeOrder").getBoundingClientRect(); return { scrolls: el.scrollHeight > el.clientHeight, inView: b.top >= 0 && b.bottom <= innerHeight }; });
  ok(r.scrolls && r.inView, "live mode at 390x600: the sheet scrolls and the place-order button is on screen without scrolling");
  await page.close();
}
{ // guest, decline then pay
  const { page, sent } = await run({});
  ok(await page.locator("#placeDemoOrder").count() === 0, "preview button replaced when config is live");
  ok(await page.locator("#coGuest").isVisible(), "guest fields shown when signed out");
  ok(/Test mode/.test(await page.locator(".cart-drawer .demo-disclaimer").textContent()) && !/nothing is sent/i.test(await page.locator("body").textContent()), "no 'preview / nothing is sent' line survives in live mode");
  ok(/Test mode/.test(await page.locator(".menu-intro").first().textContent()), "menu intro says test mode");
  await page.locator("#placeOrder").click();
  ok((await page.locator("#coError").textContent()).includes("name"), "missing name blocks submit");
  ok(sent.length === 0, "nothing sent before guest details are valid");
  await page.fill("#coName", "Test Guest"); await page.fill("#coEmail", "guest@example.invalid"); await page.fill("#coPhone", "343 999 0002"); // T-02: guests give a mobile
  await page.fill("#coNote", "Less spice please");
  await page.fill("#coCard", "4111 1111 1111 1111"); await page.locator("#placeOrder").click();
  ok(sent.length === 0, "a non-test card number sends nothing");
  await page.fill("#coCard", "4000 0000 0000 0002"); await page.locator("#placeOrder").click();
  await page.waitForFunction(() => document.getElementById("coError").textContent.length > 0);
  ok((await page.locator("#coError").textContent()).includes("declined"), "declined card shows a retry message");
  ok(await page.locator("#coEmail").isDisabled(), "email locked once the order exists");
  ok((await page.locator("#placeOrder").textContent()).includes("63.25"), "button shows the server total");
  await page.fill("#coCard", "4242 4242 4242 4242"); await page.locator("#placeOrder").click();
  await page.waitForFunction(() => /Paid/.test(document.getElementById("checkoutMessage").textContent));
  const placed = sent.filter((s) => s.u.endsWith("place_order"));
  ok(placed.length === 1, "exactly one place_order across the decline and the retry");
  const all = JSON.stringify(sent.map((s) => s.b)); if (process.env.DEBUG) console.log(all);
  ok(!/\d{12,}|\d{4} \d{4}/.test(all.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "uuid")), "no card number in any request");
  ok(!/price|total|tax/.test(JSON.stringify(placed[0].b)), "order payload has no price, tax or total");
  ok(placed[0].b.p_note === "Less spice please" && placed[0].b.p_guest_email === "guest@example.invalid", "note and guest email sent");
  ok(/code 9F3C2A/.test(await page.locator("#checkoutMessage").textContent()), "confirmation shows pickup code");
  ok(await page.evaluate(() => JSON.parse(localStorage.getItem("azal-demo-cart-v1") || "[]").length) === 0, "cart cleared after payment");
  ok(await page.locator(".checkout-live").isHidden() && await page.locator("#placeOrder").isHidden(), "form hidden after payment");
  ok((await page.locator("#checkoutMessage").textContent()).includes("say 🌙 Moon 47 (code 9F3C2A)") && (await page.textContent(".co-sigil")) === "🌙 Moon 47", "V8: confirmation gives the spoken sigil in large type, code kept");
  ok(!/\.\./.test(await page.locator("#checkoutMessage").textContent()), "no doubled period");
  await page.screenshot({ path: process.env.SHOT || "/tmp/checkout-paid.png", fullPage: false });
  await page.close();
}
{ // French: test-mode lines in FR with non-breaking spaces
  const { page } = await run({ lang: "fr" });
  const d = await page.locator(".cart-drawer .demo-disclaimer").textContent();
  ok(d.startsWith("Mode test\u00a0:") && /Aucun paiement réel/.test(await page.locator(".checkout-panel").textContent()), "FR test-mode wording");
  await page.close();
}
{ // Arabic
  const { page } = await run({ lang: "ar" });
  const t = await page.textContent(".checkout-panel");
  ok(/وضع التجربة/.test(t) && /بطاقات تجريبية/.test(t) && await page.evaluate(() => document.documentElement.dir) === "rtl", "Arabic checkout wording, RTL");
  await page.close();
}
{ // inert when config is null
  const page = await browser.newPage();
  await page.goto(`http://localhost:${port}/menu.html`);
  ok(await page.locator("#placeDemoOrder").count() === 1 && await page.locator(".checkout-live").count() === 0, "inert with null config (demo mode)");
  await page.close();
}
await browser.close(); srv.close();
console.log(fails ? `${fails} failed` : "all passed"); process.exit(fails ? 1 : 0);
