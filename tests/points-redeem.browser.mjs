// F-OWN-4 (owner first test 2026-11-27: "249 points and no way to use them"): Majlis points at checkout, FAKE Supabase.
// Members see their balance; only rewards they can use are radios (no dead controls); the next reward is plain text;
// choosing one shows a points line before HST, sends p_redeem_points, and changing the choice starts a fresh order.
// Guests see nothing; a server without 0006 (404 on redeem_options) hides the section. Run: node tests/points-redeem.browser.mjs
import { createRequire } from "node:module"; import http from "node:http"; import { readFileSync, existsSync } from "node:fs"; import { join, extname } from "node:path";
import { nullConfig } from "./null-config.mjs";
const require = createRequire(process.env.NODE_PATH ? join(process.env.NODE_PATH, "x") : import.meta.url); const { chromium } = require("playwright");
const root = new URL("..", import.meta.url).pathname; const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2" };
const srv = http.createServer((q, r) => { const p = join(root, decodeURIComponent(q.url.split("?")[0])); if (!existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": T[extname(p)] || "application/octet-stream" }); r.end(readFileSync(p)); }).listen(0);
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
const b = nullConfig(await chromium.launch()); const base = `http://localhost:${srv.address().port}`;
const RULE = { step_points: 10000, cents_per_step: 1000, max_steps: 20 };

async function open({ lang = "en", signedIn = true, balance = 12000, has0006 = true, cart = [[1, 2], [6, 1]], w = 390 } = {}) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } }); const sent = [];
  await p.clock.setFixedTime(new Date("2026-11-26T17:00:00Z"));
  await p.route("**/supabase-config.js*", (r) => r.fulfill({ contentType: "text/javascript", body: 'window.AZAL_SUPABASE=Object.freeze({url:"https://fake.supabase.co",anonKey:"anon-test"});' }));
  await p.route("https://fake.supabase.co/**", async (r) => {
    const u = r.request().url(); let body = null; try { body = r.request().postDataJSON(); } catch {} sent.push({ u, body });
    if (u.endsWith("/rpc/redeem_options")) return has0006 ? r.fulfill({ json: { balance, ...RULE } }) : r.fulfill({ status: 404, json: { message: "Could not find the function" } });
    if (u.endsWith("/rpc/place_order")) { const d = body.p_redeem_points ? body.p_redeem_points / 10 : 0; const tax = Math.floor((5597 - d) * 0.13 + 0.5); return r.fulfill({ json: { order_id: "9f3c2a10-0000-4000-8000-000000000001", pickup_at: "2026-11-26T17:25:00Z", subtotal_cents: 5597, discount_cents: d, tax_cents: tax, total_cents: 5597 - d + tax, status: "placed", payment_status: "unpaid" } }); }
    if (u.endsWith("/rpc/pay_order_test")) return r.fulfill({ json: { order_id: body.p_order, outcome: "paid", total_cents: 5760 } });
    return r.fulfill({ status: 404, json: {} });
  });
  await p.addInitScript(([l, s, c]) => { localStorage.setItem("azal-language", l); localStorage.setItem("azal-demo-cart-v1", JSON.stringify(c)); if (s) localStorage.setItem("azal-auth-v1", JSON.stringify({ access_token: "T", refresh_token: "R", expires_at: 4e12, user: { id: "u1", email: "m@example.com" } })); }, [lang, signedIn, cart]);
  await p.goto(base + "/menu.html");
  await p.evaluate(() => document.getElementById("checkoutButton").click());
  await p.waitForSelector("#placeOrder"); await p.waitForTimeout(250);
  return { p, sent };
}
const totals = (p) => p.evaluate(() => [...document.querySelectorAll("#checkoutTotals .total-line")].map((l) => l.textContent.replace(/\s+/g, " ").trim()));

{ // 12,000 pts on a $55.97 order: both rewards usable
  const { p, sent } = await open();
  ok(await p.locator("#coPoints").isVisible() && /12,000 points/.test(await p.textContent("#coPtsBalance")), "member sees the Majlis points box with balance 12,000");
  ok(await p.locator("input[name=coPts]").count() === 2 && await p.locator("#coPts0").isChecked(), "two real choices (none, 10,000); 'Don't use points' is the default");
  ok((await totals(p)).length === 3, "no points line until a reward is chosen");
  await p.check("#coPts10000"); await p.waitForTimeout(100);
  const t = await totals(p);
  ok(t.length === 4 && /^Majlis points ?−\$10\.00$/.test(t[1]) && /^HST \(13%\) ?\$5\.98$/.test(t[2]) && /^Total ?\$51\.95$/.test(t[3]) && /^Subtotal ?\$55\.97$/.test(t[0]), "10,000 pts: Subtotal $55.97 · Majlis points −$10.00 · HST $5.98 · Total $51.95 (same arithmetic as the server)");
  await p.fill("#coCard", "4242 4242 4242 4242"); await p.click("#placeOrder"); await p.waitForTimeout(300);
  const po = sent.find((s) => s.u.endsWith("/rpc/place_order"));
  ok(po && po.body.p_redeem_points === 10000 && !("p_guest_email" in po.body), "place_order is sent p_redeem_points 10000 (prices and the discount are still the server's)");
  ok(/Paid/.test(await p.textContent("#checkoutMessage")), "paid with the reward applied");
  ok(await p.evaluate(() => (window.AZAL_REDEEM_CENTS || 0) === 0), "after payment the reward is cleared (not carried to the next order)");
  await p.close();
}
{ // changing the choice after a declined/placed attempt starts a new order (no idempotency conflict)
  const { p, sent } = await open({ balance: 30000 });
  await p.check("#coPts10000"); await p.fill("#coCard", "4000 0000 0000 0002");
  await p.route("https://fake.supabase.co/rest/v1/rpc/pay_order_test", (r) => r.fulfill({ json: { outcome: "declined", reason: "card_declined" } }));
  await p.click("#placeOrder"); await p.waitForTimeout(300);
  await p.check("#coPts20000"); await p.fill("#coCard", "4000 0000 0000 0002"); await p.click("#placeOrder"); await p.waitForTimeout(300);
  const keys = sent.filter((s) => s.u.endsWith("/rpc/place_order")).map((s) => s.body.p_idempotency_key + ":" + s.body.p_redeem_points);
  ok(keys.length === 2 && keys[0].split(":")[0] !== keys[1].split(":")[0] && /:10000$/.test(keys[0]) && /:20000$/.test(keys[1]), "a different reward after placing uses a fresh order key (10,000 then 20,000)");
  await p.close();
}
{ // the owner's case: 249 points
  const { p } = await open({ balance: 249 });
  ok(await p.locator("#coPoints").isVisible() && /249 points/.test(await p.textContent("#coPtsBalance")), "249 pts: the balance is shown");
  ok(await p.locator("input[name=coPts]").count() === 0, "249 pts: no radio at all (no dead control for a reward out of reach)");
  ok(/first reward, \$10\.00 off, comes at 10,000 points/.test(await p.textContent("#coPtsNext")), "249 pts: says plainly where the first reward is");
  await p.close();
}
{ // a small order below $10 cannot use the first 10,000-point reward
  const { p } = await open({ cart: [[6, 1]] });
  ok(await p.locator("#coPts10000").count() === 1 && await p.locator("#coPts10000").count() === 0, "$10 reward hidden on an order under $10");
  await p.close();
}
{ // Arabic: the minus sits inside the left-to-right price isolate
  const { p } = await open({ lang: "ar", w: 320 });
  ok(/رصيدك 12,000 نقطة/.test(await p.textContent("#coPtsBalance")), "Arabic balance line, Latin digits");
  await p.check("#coPts10000"); await p.waitForTimeout(100);
  const line = await p.evaluate(() => document.querySelector("#checkoutTotals .total-points strong").textContent);
  ok(line.startsWith("⁦−") && line.endsWith("⁩") && /نقاط المجلس/.test((await totals(p))[1]), "Arabic points line: −$10.00 inside one LTR isolate");
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Arabic at 320px: no horizontal scroll with the points box open");
  await p.close();
}
{ // French copy
  const { p } = await open({ lang: "fr" });
  ok(/Points Majlis/.test(await p.textContent("#coPtsTitle")) && /Utiliser 10\s000 points/.test(await p.textContent("#coPoints")), "French: Points Majlis, Utiliser 5 000 points");
  await p.close();
}
{ // guests and servers without 0006
  const g = await open({ signedIn: false });
  ok(await g.p.locator("#coPoints").isHidden() && !g.sent.some((s) => s.u.endsWith("/rpc/redeem_options")), "guest: no points box and no redeem_options call");
  await g.p.close();
  const o = await open({ has0006: false });
  ok(await o.p.locator("#coPoints").isHidden(), "server without 0006: the section stays hidden");
  await o.p.fill("#coCard", "4242 4242 4242 4242"); await o.p.click("#placeOrder"); await o.p.waitForTimeout(300);
  const po = o.sent.find((s) => s.u.endsWith("/rpc/place_order"));
  ok(po && !("p_redeem_points" in po.body), "server without 0006: place_order body has no p_redeem_points (old signature still matches)");
  await o.p.close();
}
{ // ChatGPT #58 CX-1: the drawer and the sheet show the same totals once a reward is chosen, also after closing and reopening
  const { p } = await open();
  await p.check("#coPts10000"); await p.waitForTimeout(100);
  await p.evaluate(() => document.querySelector("#checkoutModal .modal-close")?.click()); await p.waitForTimeout(150);
  const drawer = await p.evaluate(() => [document.getElementById("cartTax")?.textContent, document.getElementById("cartGrand")?.textContent]);
  ok(drawer[0] === "$5.98" && drawer[1] === "$51.95", "after closing the sheet the drawer shows the same HST $5.98 and total $51.95");
  await p.evaluate(() => document.getElementById("checkoutButton").click()); await p.waitForTimeout(250);
  const t = await totals(p);
  ok(await p.locator("#coPts10000").isChecked() && /−\$10\.00/.test(t[1]) && /\$51\.95/.test(t[3]), "reopened: the reward is still chosen and the sheet still totals $51.95");
  await p.check("#coPts0"); await p.waitForTimeout(100);
  ok(await p.evaluate(() => document.getElementById("cartGrand")?.textContent) === "$63.25" && (await totals(p)).length === 3, "back to no points: drawer and sheet both return to $63.25");
  await p.close();
}
{ // CX-2: plenty of points but an order smaller than the smallest reward: a plain line, never a blank box
  const q = await open({ cart: [[8, 1]], balance: 12000 }); // Adeni chai, $3.99
  const sub = await q.p.evaluate(() => cartTotals([...cart.entries()]).sub);
  if (sub < 500) {
    ok(await q.p.locator("input[name=coPts]").count() === 0 && /take \$10\.00 off an order of \$10\.00 or more/.test(await q.p.textContent("#coPtsNext")) && await q.p.locator("#coPtsNext").isVisible(), "12,000 pts on a sub-$5 order: no radio, a clear line about the minimum order");
  } else ok(false, "fixture: expected an item under $5 (got " + sub + ")");
  await q.p.close();
}
{ // CX-3: tiers vanish after a reward was chosen: the hidden reward is cleared from totals and the request
  const { p, sent } = await open();
  await p.check("#coPts10000"); await p.waitForTimeout(100);
  await p.route("https://fake.supabase.co/rest/v1/rpc/redeem_options", (r) => r.fulfill({ json: { balance: 12000, tiers: [] } }));
  await p.evaluate(() => document.querySelector("#checkoutModal .modal-close")?.click()); await p.evaluate(() => document.getElementById("checkoutButton").click()); await p.waitForTimeout(300);
  ok(await p.locator("#coPoints").isHidden() && await p.evaluate(() => (window.AZAL_REDEEM_CENTS || 0) === 0) && (await totals(p)).length === 3, "empty tiers: the section hides AND the chosen reward is cleared from the totals");
  await p.fill("#coCard", "4242 4242 4242 4242"); await p.click("#placeOrder"); await p.waitForTimeout(300);
  const po = sent.filter((s) => s.u.endsWith("/rpc/place_order")).pop();
  ok(po && !("p_redeem_points" in po.body), "empty tiers: place_order carries no stale p_redeem_points");
  await p.close();
}
await b.close(); srv.close(); if (fails) { console.log(fails + " failed"); process.exit(1); } else console.log("all passed");
