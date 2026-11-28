// T-22 / F-OWN-21 (owner, laptop 19:27): sign-in and create-account happen INSIDE the checkout sheet. No choice, link
// or button in the sheet navigates; the cart, pickup time and note stay as they are; every state has a way on.
// FAKE Supabase. Run: node tests/checkout-inline-auth.browser.mjs
import { createRequire } from "node:module"; import http from "node:http"; import { readFileSync, existsSync } from "node:fs"; import { join, extname } from "node:path";
import { nullConfig } from "./null-config.mjs";
const require = createRequire(process.env.NODE_PATH ? join(process.env.NODE_PATH, "x") : import.meta.url); const { chromium } = require("playwright");
const root = new URL("..", import.meta.url).pathname; const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2" };
const srv = http.createServer((q, r) => { const p = join(root, decodeURIComponent(q.url.split("?")[0])); if (!existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": T[extname(p)] || "application/octet-stream" }); r.end(readFileSync(p)); }).listen(0);
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
const b = nullConfig(await chromium.launch()); const base = `http://localhost:${srv.address().port}`;
const ORDER = { order_id: "9f3c2a10-0000-4000-8000-000000000001", pickup_at: "2026-11-26T17:25:00Z", subtotal_cents: 2499, tax_cents: 325, total_cents: 2824, status: "placed", payment_status: "unpaid" };
const SESSION = { access_token: "T", refresh_token: "R", expires_in: 3600, user: { id: "u1", email: "m@example.com" } };

// signup: "session" (no confirmation), "confirm" (confirmation pending), "exists"
async function open({ lang = "en", w = 390, signup = "session", claim = 0 } = {}) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } }); const sent = []; const navs = [];
  await p.clock.setFixedTime(new Date("2026-11-26T17:00:00Z"));
  await p.route("**/supabase-config.js*", (r) => r.fulfill({ contentType: "text/javascript", body: 'window.AZAL_SUPABASE=Object.freeze({url:"https://fake.supabase.co",anonKey:"anon"});' }));
  await p.route("https://fake.supabase.co/**", (r) => {
    const req = r.request(), u = decodeURIComponent(req.url()); let body = null; try { body = req.postDataJSON(); } catch {} sent.push({ u, body, auth: req.headers().authorization || "" });
    if (u.includes("/auth/v1/token?grant_type=password")) return body.password === "rightpass1" ? r.fulfill({ json: SESSION }) : r.fulfill({ status: 400, json: { error: "invalid_grant", error_description: "Invalid login credentials" } });
    if (u.includes("/auth/v1/signup")) {
      if (signup === "exists") return r.fulfill({ status: 422, json: { msg: "User already registered" } });
      if (signup === "confirm") return r.fulfill({ json: { id: "u2", email: body.email, confirmation_sent_at: "2026-11-26T17:00:00Z" } });
      return r.fulfill({ json: { ...SESSION, user: { id: "u2", email: body.email } } });
    }
    if (u.endsWith("/rpc/claim_guest_points")) return r.fulfill({ json: { points_added: claim } });
    if (u.endsWith("/rpc/place_order")) return r.fulfill({ json: ORDER });
    if (u.endsWith("/rpc/pay_order_test")) return r.fulfill({ json: { order_id: body.p_order, outcome: "paid", total_cents: 2824 } });
    if (u.endsWith("/rpc/redeem_options")) return r.fulfill({ json: { balance: 0, tiers: [{ points: 10000, cents: 1000 }] } });
    if (u.includes("/rest/v1/profiles")) return r.fulfill({ json: [{ id: "u1", display_name: "Huda", phone: "+13439990001" }] });
    if (u.includes("/rest/v1/memberships")) return r.fulfill({ json: [{ status: "active" }] });
    if (u.includes("/rest/v1/points_ledger")) return r.fulfill({ json: [] });
    return r.fulfill({ status: 404, json: {} });
  });
  await p.addInitScript((l) => { localStorage.setItem("azal-language", l); localStorage.setItem("azal-demo-cart-v1", JSON.stringify([[1, 2], [6, 1]])); }, lang);
  await p.goto(base + "/menu.html");
  p.on("framenavigated", (f) => { if (f === p.mainFrame()) navs.push(f.url()); });
  await p.evaluate(() => document.getElementById("checkoutButton").click());
  await p.waitForSelector("#coWho:not([hidden])");
  return { p, sent, navs, url: p.url() };
}
const focused = (p) => p.evaluate(() => document.activeElement && document.activeElement.id);
const noLinksOut = (p) => p.evaluate(() => document.querySelectorAll("#checkoutModal a[href]").length === 0);
const fits = (p) => p.evaluate(() => { const c = document.querySelector(".checkout-panel"); return document.documentElement.scrollWidth <= innerWidth && c.scrollWidth <= c.clientWidth + 1; });

for (const w of [1280, 390]) { // the owner's laptop first, then a phone
  const { p, sent, navs, url } = await open({ w });
  ok(await noLinksOut(p), `@${w}: the sheet has no link that leaves the page`);
  if (await p.locator("input[name='pickup']").count() > 1) await p.locator("input[name='pickup']").nth(1).check();
  const choice = await p.evaluate(() => pickupState.choice);
  await p.click("#coWhoSignIn");
  ok(await p.locator("#coAuth").isVisible() && await p.locator("#coWho").isHidden() && await p.locator("#coAuthNameRow").isHidden() && await focused(p) === "coAuthEmail", `@${w} Sign in: the form opens in the sheet, email focused`);
  ok(/New here\? Create an account/.test(await p.textContent("#coAuthSwitch")), `@${w} the switch uses the same words as the choice`);
  ok(await p.locator("#placeOrder").isHidden() && await p.locator("#coFields").isHidden(), `@${w} Sign in: no pay button or guest fields meanwhile`);
  await p.fill("#coAuthEmail", "m@example.com"); await p.fill("#coAuthPassword", "wrong-pass"); await p.click("#coAuthSubmit"); await p.waitForTimeout(300);
  ok(/don’t match/.test(await p.textContent("#coAuthMsg")) && await focused(p) === "coAuthPassword" && await p.locator("#coAuth").isVisible(), `@${w} wrong password: told in the sheet, focus on the password`);
  await p.fill("#coAuthPassword", "rightpass1"); await p.click("#coAuthSubmit"); await p.waitForTimeout(700);
  ok(navs.length === 0 && p.url() === url, `@${w} signed in WITHOUT any page change (same URL, no navigation)`);
  ok(await p.locator("#coAuth").isHidden() && /You’re signed in\. Your order is just as you left it\. Ordering as m@example\.com/.test(await p.textContent("#coSigned")), `@${w} the sheet flips to the member state in place`);
  ok(await p.inputValue("#coPhone") === "+13439990001" && await p.locator("#placeOrder").isVisible() && await p.locator("#coGuest").isHidden(), `@${w} member state: profile mobile filled, pay button back, no guest fields`);
  ok(await p.evaluate(() => JSON.stringify([...cart.entries()])) === "[[1,2],[6,1]]" && await p.evaluate(() => pickupState.choice) === choice, `@${w} cart and pickup time untouched`);
  ok(sent.some((s) => s.u.endsWith("/rpc/claim_guest_points")), `@${w} points from earlier guest orders are claimed at sign-in`);
  ok(await p.textContent('.nav a[data-i18n="navMajlis"]') === "My Majlis", `@${w} the header knows you are signed in`);
  await p.fill("#coNote", "No onions"); await p.fill("#coCard", "4242 4242 4242 4242"); await p.click("#placeOrder"); await p.waitForTimeout(600);
  const po = sent.find((s) => s.u.endsWith("/rpc/place_order"));
  ok(po && po.auth === "Bearer T" && !("p_guest_email" in po.body) && po.body.p_note === "No onions", `@${w} pays as the member: token sent, no guest details`);
  ok(await fits(p), `@${w}: no sideways scroll`);
  await p.close();
}
{ // Create an account in the sheet (no confirmation needed): straight to the member state
  const { p, sent, navs } = await open();
  await p.click("#coWhoJoin");
  ok(await p.locator("#coAuthNameRow").isVisible() && await p.locator("#coAuthPhoneRow").isVisible() && await focused(p) === "coAuthName" && /Create an account/.test(await p.textContent("#coAuthTitle")), "Create an account: the registration form opens in the sheet (name, email, mobile, password)");
  await p.click("#coAuthSubmit"); await p.waitForTimeout(150);
  ok(/add your name/.test(await p.textContent("#coAuthMsg")) && await focused(p) === "coAuthName" && !sent.some((s) => s.u.includes("/signup")), "empty name: told, focused, nothing sent");
  await p.fill("#coAuthName", "Noor"); await p.fill("#coAuthEmail", "noor@example.com"); await p.fill("#coAuthPhone", "12"); await p.fill("#coAuthPassword", "longenough");
  await p.click("#coAuthSubmit"); await p.waitForTimeout(150);
  ok(/check your mobile/.test(await p.textContent("#coAuthMsg")) && await focused(p) === "coAuthPhone", "bad mobile: told before sending");
  await p.fill("#coAuthPhone", "(613) 555-0180"); await p.fill("#coAuthPassword", "short"); await p.click("#coAuthSubmit"); await p.waitForTimeout(150);
  ok(/longer password/.test(await p.textContent("#coAuthMsg")) && !sent.some((s) => s.u.includes("/signup")), "short password: told before sending");
  await p.fill("#coAuthPassword", "longenough"); await p.click("#coAuthSubmit"); await p.waitForTimeout(700);
  const su = sent.find((s) => s.u.includes("/auth/v1/signup"));
  ok(su && su.body.email === "noor@example.com" && su.body.data.display_name === "Noor" && su.body.data.phone === "+16135550180", "the account is created with name and normalised mobile");
  ok(navs.length === 0 && await p.locator("#coAuth").isHidden() && /Ordering as noor@example\.com/.test(await p.textContent("#coSigned")) && await p.locator("#placeOrder").isVisible(), "account created: member state in place, no navigation");
  await p.close();
}
{ // Create an account when the email must be confirmed first: said plainly, never a dead end
  const { p, navs } = await open({ signup: "confirm" });
  await p.click("#coWhoJoin");
  await p.fill("#coAuthName", "Noor"); await p.fill("#coAuthEmail", "noor@example.com"); await p.fill("#coAuthPhone", "6135550180"); await p.fill("#coAuthPassword", "longenough");
  await p.click("#coAuthSubmit"); await p.waitForTimeout(500);
  ok(/sent a confirmation link to noor@example\.com/.test(await p.textContent("#coAuthSent")) && await p.locator("#coAuthForm").isHidden(), "confirmation pending: the sheet says so, with the address");
  ok(await p.locator("#coAuthSwitch").isVisible() && await p.locator("#coAuthGuest").isVisible() && await p.locator("#coAuthBack").isVisible(), "…and offers: I’ve confirmed: sign in · Continue as guest · Back");
  await p.click("#coAuthSwitch");
  ok(await p.locator("#coAuthForm").isVisible() && await p.inputValue("#coAuthEmail") === "noor@example.com" && await p.locator("#coAuthNameRow").isHidden() && await focused(p) === "coAuthPassword", "I’ve confirmed: the sign-in form, email filled, focus on the password");
  await p.click("#coAuthGuest");
  ok(await p.locator("#coAuth").isHidden() && await p.locator("#coName").isVisible() && await p.locator("#placeOrder").isVisible() && navs.length === 0, "Continue as guest from there: the guest form, still no navigation");
  await p.close();
}
{ const { p } = await open({ signup: "exists" });
  await p.click("#coWhoJoin");
  await p.fill("#coAuthName", "Noor"); await p.fill("#coAuthEmail", "m@example.com"); await p.fill("#coAuthPhone", "6135550180"); await p.fill("#coAuthPassword", "longenough");
  await p.click("#coAuthSubmit"); await p.waitForTimeout(400);
  ok(/already has an account/.test(await p.textContent("#coAuthMsg")) && /Have an account\? Sign in/.test(await p.textContent("#coAuthSwitch")), "email already registered: told, with Sign in right there");
  await p.click("#coAuthSwitch");
  ok(await p.inputValue("#coAuthEmail") === "m@example.com" && await p.locator("#coAuthNameRow").isHidden(), "switching keeps the typed email");
  await p.close();
}
{ // the guest form's "Sign in instead" switches in place, and Back returns to the guest form as it was
  const { p, navs } = await open({ w: 1280 });
  await p.click("#coWhoGuest"); await p.fill("#coName", "Amal"); await p.fill("#coNote", "Extra bread");
  ok(await p.locator("#coWhoBack").isVisible() && (await p.evaluate(() => document.getElementById("coWhoBack").tagName)) === "BUTTON", "guest form: Sign in instead is a real button");
  await p.click("#coWhoBack");
  ok(await p.locator("#coAuth").isVisible() && await p.locator("#coFields").isHidden() && await focused(p) === "coAuthEmail" && navs.length === 0, "Sign in instead: the sign-in form opens in place");
  await p.click("#coAuthBack");
  ok(await p.locator("#coAuth").isHidden() && await p.inputValue("#coName") === "Amal" && await p.inputValue("#coNote") === "Extra bread" && await focused(p) === "coName", "Back: the guest form, with what was typed");
  await p.click("#coWhoBack"); await p.click("#coAuthGuest");
  ok(await p.locator("#coName").isVisible() && await p.locator("#coAuthGuest").isVisible() === false, "Continue as guest from the sign-in form works too");
  await p.close();
}
{ const { p } = await open();
  await p.click("#coWhoSignIn"); await p.click("#coAuthBack");
  ok(await p.locator("#coWho").isVisible() && await p.locator("#coAuth").isHidden() && await focused(p) === "coWhoSignIn", "Back from the choice's sign-in: the three options again");
  await p.click("#coWhoSignIn"); await p.fill("#coAuthEmail", "m@example.com");
  await p.click("#modalClose"); await p.evaluate(() => document.getElementById("checkoutButton").click()); await p.waitForTimeout(300);
  ok(await p.locator("#coWho").isVisible() && await p.locator("#coAuth").isHidden(), "closing and reopening the sheet starts again at the choice");
  await p.close();
}
{ // after a guest order: "Join & collect these points" opens the join form in the sheet, email locked
  const { p, sent, navs } = await open({ claim: 120 });
  await p.click("#coWhoGuest");
  await p.fill("#coName", "Amal"); await p.fill("#coEmail", "amal@example.com"); await p.fill("#coPhone", "6135550180"); await p.fill("#coCard", "4242 4242 4242 4242");
  await p.click("#placeOrder"); await p.waitForTimeout(700);
  ok(await p.locator("#coJoin").isVisible() && (await p.evaluate(() => document.getElementById("coJoin").tagName)) === "BUTTON" && await noLinksOut(p), "paid guest: Join & collect is a button, nothing links away");
  await p.click("#coJoin");
  ok(await p.locator("#coAuth").isVisible() && await p.inputValue("#coAuthEmail") === "amal@example.com" && await p.getAttribute("#coAuthEmail", "readonly") !== null && await p.locator("#coAuthLocked").isVisible(), "the join form opens under the confirmation, with the order's email locked");
  ok(await p.inputValue("#coAuthName") === "Amal" && await p.inputValue("#coAuthPhone") === "+16135550180" && await focused(p) === "coAuthPassword", "name and mobile from the order are filled in: only the password is left");
  ok(await p.locator("#coAuthGuest").isHidden() && await p.locator("#coAuthSwitch").isHidden(), "after the order: no guest/sign-in switches to confuse it");
  await p.click("#coAuthBack");
  ok(await p.locator("#coAuth").isHidden() && await p.locator("#coJoin").isVisible() && await focused(p) === "coJoin", "Back: the join button again");
  await p.click("#coJoin"); await p.fill("#coAuthPassword", "longenough");
  await p.click("#coAuthSubmit"); await p.waitForTimeout(800);
  ok(sent.find((s) => s.u.includes("/signup")).body.email === "amal@example.com" && sent.some((s) => s.u.endsWith("/rpc/claim_guest_points")), "the account is created with the order's email, and its points are claimed");
  ok(/We added 120 points/.test(await p.textContent("#coAuthDone")) && await p.locator("#coAuth").isHidden() && navs.length === 0, "the sheet says the points were added; no page change");
  await p.close();
}
{ // Arabic at 320 and French at 390 with the forms open; a language switch keeps what was typed
  const { p } = await open({ lang: "ar", w: 320 });
  await p.click("#coWhoJoin");
  ok(/إنشاء حساب/.test(await p.textContent("#coAuthTitle")) && /أنشئ الحساب وتابع/.test(await p.textContent("#coAuthSubmit")) && /رجوع/.test(await p.textContent("#coAuthBack")) && await fits(p), "Arabic @320: the join form reads in Arabic, no sideways scroll");
  await p.fill("#coAuthName", "نور"); await p.fill("#coAuthEmail", "noor@example.com");
  await p.click("#languageToggle").catch(() => {}); await p.waitForTimeout(300);
  ok(await p.inputValue("#coAuthName") === "نور" && await p.inputValue("#coAuthEmail") === "noor@example.com" && await p.locator("#coAuth").isVisible(), "a language switch keeps the open form and what was typed");
  await p.close();
}
{ const { p } = await open({ lang: "fr", w: 390, signup: "confirm" });
  await p.click("#coWhoJoin");
  await p.fill("#coAuthName", "Noor"); await p.fill("#coAuthEmail", "noor@example.com"); await p.fill("#coAuthPhone", "6135550180"); await p.fill("#coAuthPassword", "longenough");
  await p.click("#coAuthSubmit"); await p.waitForTimeout(500);
  ok(/lien de confirmation à noor@example\.com/.test(await p.textContent("#coAuthSent")) && /J’ai confirmé/.test(await p.textContent("#coAuthSwitch")) && await fits(p), "French @390: the confirmation step reads in French, no sideways scroll");
  await p.close();
}
await b.close(); srv.close(); if (fails) { console.log(fails + " failed"); process.exit(1); } else console.log("all passed");
