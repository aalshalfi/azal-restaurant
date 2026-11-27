// T-02 / F-OWN-16 (owner demo 15:56): guest checkout asks a mobile (the kitchen must be able to call); members get their
// profile mobile, editable for this order; the kitchen ticket shows it (tap to call); the customer's order detail shows
// it; the guest confirmation's join line is a real button to the join form with the order's email locked.
// FAKE Supabase. Run: node tests/guest-phone.browser.mjs
import { createRequire } from "node:module"; import http from "node:http"; import { readFileSync, existsSync } from "node:fs"; import { join, extname } from "node:path";
import { nullConfig } from "./null-config.mjs";
const require = createRequire(process.env.NODE_PATH ? join(process.env.NODE_PATH, "x") : import.meta.url); const { chromium } = require("playwright");
const root = new URL("..", import.meta.url).pathname; const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2" };
const srv = http.createServer((q, r) => { const p = join(root, decodeURIComponent(q.url.split("?")[0])); if (!existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": T[extname(p)] || "application/octet-stream" }); r.end(readFileSync(p)); }).listen(0);
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
const b = nullConfig(await chromium.launch()); const base = `http://localhost:${srv.address().port}`;
const ORDER = { order_id: "9f3c2a10-0000-4000-8000-000000000001", pickup_at: "2026-11-26T17:25:00Z", subtotal_cents: 2499, tax_cents: 325, total_cents: 2824, status: "placed", payment_status: "unpaid" };

async function checkout({ signedIn = false, lang = "en", w = 390, pre0010 = false, profilePhone = "+13439990001" } = {}) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } }); const sent = [];
  await p.clock.setFixedTime(new Date("2026-11-26T17:00:00Z"));
  await p.route("**/supabase-config.js*", (r) => r.fulfill({ contentType: "text/javascript", body: 'window.AZAL_SUPABASE=Object.freeze({url:"https://fake.supabase.co",anonKey:"anon"});' }));
  await p.route("https://fake.supabase.co/**", (r) => {
    const u = decodeURIComponent(r.request().url()); let body = null; try { body = r.request().postDataJSON(); } catch {} sent.push({ u, body });
    if (u.endsWith("/rpc/place_order")) { if (pre0010 && body.p_guest_phone) return r.fulfill({ status: 404, json: { code: "PGRST202", message: "Could not find the function public.place_order" } }); return r.fulfill({ json: ORDER }); }
    if (u.endsWith("/rpc/pay_order_test")) return r.fulfill({ json: { order_id: body.p_order, outcome: "paid", total_cents: 2824 } });
    if (u.endsWith("/rpc/redeem_options")) return r.fulfill({ json: { balance: 0, tiers: [{ points: 10000, cents: 1000 }] } });
    if (u.includes("/rest/v1/profiles")) return r.fulfill({ json: [{ id: "u1", display_name: "Huda", phone: profilePhone }] });
    if (u.includes("/rest/v1/memberships")) return r.fulfill({ json: [{ status: "active" }] });
    if (u.includes("/rest/v1/points_ledger")) return r.fulfill({ json: [] });
    return r.fulfill({ status: 404, json: {} });
  });
  await p.addInitScript(([l, s]) => { localStorage.setItem("azal-language", l); localStorage.setItem("azal-demo-cart-v1", JSON.stringify([[1, 1]])); if (s) localStorage.setItem("azal-auth-v1", JSON.stringify({ access_token: "T", refresh_token: "R", expires_at: 4e12, user: { id: "u1", email: "m@example.com" } })); }, [lang, signedIn]);
  await p.goto(base + "/menu.html");
  await p.evaluate(() => document.getElementById("checkoutButton").click()); await p.waitForSelector("#placeOrder"); await p.waitForTimeout(300);
  return { p, sent };
}
const po = (sent) => sent.filter((s) => s.u.endsWith("/rpc/place_order"));

{ const { p, sent } = await checkout();
  ok(await p.locator("#coPhone").isVisible() && /Mobile number/.test(await p.textContent("label[for=coPhone]")) && await p.getAttribute("#coPhone", "type") === "tel" && await p.getAttribute("#coPhone", "dir") === "ltr", "guest: a mobile field (tel, LTR) says why it is asked");
  await p.fill("#coName", "Amal"); await p.fill("#coEmail", "Amal@Example.invalid"); await p.fill("#coCard", "4242 4242 4242 4242");
  await p.click("#placeOrder"); await p.waitForTimeout(200);
  ok(/add your mobile/.test(await p.textContent("#coError")) && await p.evaluate(() => document.activeElement.id) === "coPhone" && po(sent).length === 0, "guest without a mobile: told, focused, nothing sent");
  await p.fill("#coPhone", "343abc9990002"); await p.click("#placeOrder"); await p.waitForTimeout(200);
  ok(/check your mobile/.test(await p.textContent("#coError")) && po(sent).length === 0, "guest with a malformed mobile: refused before sending");
  await p.fill("#coPhone", "(343) 999-0002"); await p.click("#placeOrder"); await p.waitForTimeout(500);
  ok(po(sent).length === 1 && po(sent)[0].body.p_guest_phone === "+13439990002", "guest mobile sent normalised as p_guest_phone");
  const join = p.locator("#coJoin");
  ok(await join.isVisible() && /Join & collect these points/.test(await join.textContent()) && await join.getAttribute("href") === "member.html#join=amal%40example.invalid", "paid guest: a real 'Join & collect these points' button to the join form (email in the fragment only)");
  await p.close(); }
{ const { p, sent } = await checkout({ pre0010: true });
  await p.fill("#coName", "Amal"); await p.fill("#coEmail", "amal@example.invalid"); await p.fill("#coPhone", "3439990002"); await p.fill("#coCard", "4242 4242 4242 4242");
  await p.click("#placeOrder"); await p.waitForTimeout(500);
  const calls = po(sent);
  ok(calls.length === 2 && calls[0].body.p_guest_phone && !("p_guest_phone" in calls[1].body) && /Paid/.test(await p.textContent("#checkoutMessage")), "before 0010: one 404, one retry without the phone, order paid (no outage between merge and apply)");
  await p.close(); }
{ const { p, sent } = await checkout({ signedIn: true });
  ok(await p.inputValue("#coPhone") === "+13439990001" && /for this order/.test(await p.textContent("label[for=coPhone]")), "member: profile mobile pre-filled, labelled 'for this order'");
  await p.fill("#coPhone", "613 555 0199"); await p.fill("#coCard", "4242 4242 4242 4242"); await p.click("#placeOrder"); await p.waitForTimeout(500);
  ok(po(sent)[0].body.p_guest_phone === "+16135550199" && !("p_guest_email" in po(sent)[0].body), "member: a changed mobile is sent for this order");
  ok(await p.locator("#coJoin").count() === 0, "member: no join button");
  await p.close(); }
{ const { p, sent } = await checkout({ signedIn: true, profilePhone: null });
  ok(await p.inputValue("#coPhone") === "", "member with no mobile on file: empty field");
  await p.fill("#coCard", "4242 4242 4242 4242"); await p.click("#placeOrder"); await p.waitForTimeout(500);
  ok(po(sent).length === 1 && !("p_guest_phone" in po(sent)[0].body), "member may leave it empty (the server uses the profile mobile)");
  await p.close(); }
{ const { p } = await checkout({ lang: "ar", w: 320 });
  ok(/رقم الجوال/.test(await p.textContent("label[for=coPhone]")) && await p.evaluate(() => document.querySelector(".checkout-panel").scrollWidth <= document.querySelector(".checkout-panel").clientWidth + 1), "Arabic at 320px: labelled mobile field, the sheet does not scroll sideways");
  await p.close(); }
{ // the join page
  const p = await b.newPage({ viewport: { width: 390, height: 900 } }); const sent = [];
  await p.route("**/supabase-config.js*", (r) => r.fulfill({ contentType: "text/javascript", body: 'window.AZAL_SUPABASE=Object.freeze({url:"https://fake.supabase.co",anonKey:"anon"});' }));
  await p.route("https://fake.supabase.co/**", (r) => { const u = r.request().url(); let body = null; try { body = r.request().postDataJSON(); } catch {} sent.push({ u, body }); return u.includes("/auth/v1/signup") ? r.fulfill({ json: { user: { id: "u9" } } }) : r.fulfill({ status: 401, json: {} }); });
  await p.goto(base + "/member.html#join=amal%40example.invalid"); await p.waitForSelector("#authForm");
  ok(await p.locator("#authName").count() === 1 && await p.inputValue("#authEmail") === "amal@example.invalid" && await p.getAttribute("#authEmail", "readonly") !== null && /order’s email/.test(await p.textContent("#authJoinNote")), "join page: the join form, the order's email filled in and locked, with a plain note");
  ok(!p.url().includes("#join") && !p.url().includes("example.invalid"), "the email does not stay in the address bar");
  await p.fill("#authName", "Amal"); await p.fill("#authPhone", "3439990002"); await p.fill("#authPassword", "longenough"); await p.click("#authSubmit"); await p.waitForTimeout(400);
  const su = sent.find((s) => s.u.includes("/auth/v1/signup"));
  ok(su && su.body.email === "amal@example.invalid", "sign-up uses exactly the order's email (so the pending claim attaches on confirmation)");
  await p.close(); }
{ // kitchen ticket + order detail
  const p = await b.newPage({ viewport: { width: 390, height: 900 } });
  await p.route("**/supabase-config.js*", (r) => r.fulfill({ contentType: "text/javascript", body: 'window.AZAL_SUPABASE=Object.freeze({url:"https://fake.supabase.co",anonKey:"anon"});' }));
  await p.route("https://fake.supabase.co/**", (r) => { const u = decodeURIComponent(r.request().url());
    if (u.includes("azal_staff_can_access")) return r.fulfill({ json: true });
    if (u.includes("/rest/v1/orders")) return r.fulfill({ json: [{ id: "abc12300-0000-4000-8000-000000000001", fulfilment_status: "placed", total_cents: 2824, guest_name: "Amal", contact_phone: "+13439990002", order_items: [{ quantity: 1, item_name_en_snapshot: "Lamb Mandi" }] }] });
    return r.fulfill({ status: 404, json: {} }); });
  await p.addInitScript(() => localStorage.setItem("azal-auth-v1", JSON.stringify({ access_token: "T", refresh_token: "R", expires_at: 4e12, user: { id: "s1", email: "s@example.com" } })));
  await p.goto(base + "/staff.html"); await p.waitForSelector(".staff-order");
  ok(await p.getAttribute(".staff-phone", "href") === "tel:+13439990002" && /\+13439990002/.test(await p.textContent(".staff-phone")), "kitchen ticket: the mobile, tap to call");
  await p.close(); }
await b.close(); srv.close(); if (fails) { console.log(fails + " failed"); process.exit(1); } else console.log("all passed");
