// Table Pulse with a FAKE Supabase whose order status advances. Run: node tests/pulse.browser.mjs
import { createRequire } from "node:module"; import http from "node:http"; import { readFileSync, existsSync } from "node:fs"; import { join, extname } from "node:path";
import { nullConfig } from "./null-config.mjs";
const require = createRequire(process.env.NODE_PATH ? join(process.env.NODE_PATH, "x") : import.meta.url); const { chromium } = require("playwright");
const root = new URL("..", import.meta.url).pathname; const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };
const srv = http.createServer((q, r) => { const p = join(root, decodeURIComponent(q.url.split("?")[0])); if (!existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": T[extname(p)] || "application/octet-stream" }); r.end(readFileSync(p)); }).listen(0);
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
const b = nullConfig(await chromium.launch()); const port = srv.address().port;
async function open({ status = "accepted", lang = "en", w = 390, signedIn = true, failAll = false } = {}) {
  const page = await b.newPage({ viewport: { width: w, height: 900 } });
  await page.clock.install({ time: new Date("2026-11-27T17:00:00Z") });
  const st = { status, polls: 0, pay: "paid" };
  await page.route("**/supabase-config.js*", (r) => r.fulfill({ contentType: "text/javascript", body: 'window.AZAL_SUPABASE=Object.freeze({url:"https://fake.supabase.co",anonKey:"anon"});' }));
  await page.route("https://fake.supabase.co/**", (r) => {
    const u = decodeURIComponent(r.request().url());
    if (u.includes("/rest/v1/orders?select=id,fulfilment_status")) { st.polls++; if (failAll) return r.fulfill({ status: 500, json: {} });
      const row = { id: "abc12300-0000-4000-8000-000000000001", fulfilment_status: st.status, payment_status: st.pay, rejection_reason: st.reason, pickup_slot: "2026-11-27T17:30:00Z", updated_at: "2026-11-27T17:00:00Z" };
      if (u.includes("fulfilment_status=not.in") && ["handed_over", "cancelled"].includes(st.status)) return r.fulfill({ json: [] });
      if (u.includes("rejection_reason=not.is.null") && !st.reason) return r.fulfill({ json: [] });
      return r.fulfill({ json: [row] }); }
    if (u.includes("/rest/v1/orders")) return r.fulfill({ json: [] });
    if (u.includes("/points_ledger")) return r.fulfill({ json: [] });
    if (u.includes("/profiles")) return r.fulfill({ json: [{ id: "u1", display_name: null }] });
    if (u.includes("/memberships")) return r.fulfill({ json: [{ status: "active" }] });
    if (u.includes("claim_guest_points")) return r.fulfill({ json: { points_added: 0 } });
    return r.fulfill({ status: 404, json: {} });
  });
  await page.addInitScript(([l, s]) => { localStorage.setItem("azal-language", l); if (s) localStorage.setItem("azal-auth-v1", JSON.stringify({ access_token: "T", refresh_token: "R", expires_at: 4e12, user: { id: "u1", email: "m@example.com" } })); }, [lang, signedIn]);
  await page.goto(`http://localhost:${port}/member.html`);
  return { page, st };
}
const labels = (page) => page.$$eval(".pulse-step", (ls) => ls.map((l) => l.className.replace("pulse-step ", "") + ":" + l.querySelector(".pulse-label").textContent).join(" | "));
{
  const { page, st } = await open();
  await page.waitForSelector("#tablePulse:not([hidden]) .pulse-step");
  ok(/is-done:Received \| is-current:Accepted by the kitchen \| is-todo:Ready for pickup \| is-todo:Collected/.test(await labels(page)), "accepted: Received done, Accepted current; no Preparing invented");
  ok(/Code ABC123/.test(await page.textContent("#tablePulse")) && /Pickup time: 12:30/.test(await page.textContent("#tablePulse")), "code and the chosen pickup time (labelled, not an ETA)");
  ok(!/min|ETA|almost|%/i.test(await page.textContent("#tablePulse .pulse-steps")), "no countdown or estimate anywhere in the timeline");
  st.status = "ready"; await page.clock.runFor(26000); await page.waitForFunction(() => /is-current/.test(document.querySelectorAll(".pulse-step")[2].className));
  ok(/is-current:Ready for pickup/.test(await labels(page)), "advances only after the server reports ready (poll)");
  ok(/Ready for pickup/.test(await page.textContent("#tablePulse + p[role=status]")), "screen-reader announcement on a real change");
  await page.locator("#tablePulse").scrollIntoViewIfNeeded(); await page.locator("#tablePulse").screenshot({ path: process.env.SHOT || "/tmp/pulse.png" });
  st.status = "handed_over"; await page.clock.runFor(26000); await page.waitForFunction(() => document.querySelectorAll(".pulse-step.is-done").length === 4);
  const n = st.polls; await page.clock.runFor(120000); ok(st.polls === n, "stops polling once collected");
  await page.close();
}
{ const { page } = await open({ status: "preparing" }); await page.waitForSelector(".pulse-step");
  ok(/is-current:Being prepared/.test(await labels(page)), "Preparing shown only because the server reports preparing"); await page.close(); }
{ const { page, st } = await open({ status: "accepted" }); await page.waitForSelector(".pulse-step");
  st.status = "cancelled"; st.reason = "Sold out <b>today</b>"; await page.clock.runFor(26000); await page.waitForSelector(".pulse-reason");
  ok(/Rejected by the kitchen/.test(await page.textContent("#tablePulse")) && /Sold out <b>today<\/b>/.test(await page.textContent(".pulse-reason")) && await page.locator(".pulse-reason b").count() === 0, "status shows rejection and reason as text");
  await page.close(); }
{ const { page, st } = await open({ status: "accepted" }); await page.waitForSelector(".pulse-step");
  st.status = "cancelled"; await page.clock.runFor(26000); await page.waitForSelector(".pulse-step.is-cancelled");
  const t = await page.textContent("#tablePulse");
  ok(/Order cancelled/.test(t) && await page.locator(".pulse-step").count() === 1 && !/Pickup time/.test(t), "visible order becomes cancelled: explicit 'Order cancelled', timeline replaced");
  ok(/Order cancelled/.test(await page.textContent("#tablePulse + p[role=status]")), "cancellation announced");
  const n = st.polls; await page.clock.runFor(120000); ok(st.polls === n, "stops polling once cancelled");
  ok(/Last checked/.test(t), "timestamp labelled as the last check, not a server update"); await page.close(); }
{ const { page, st } = await open({ status: "accepted" }); await page.waitForSelector(".pulse-step");
  st.pay = "refunded"; await page.clock.runFor(26000); await page.waitForSelector(".pulse-inactive");
  ok(await page.locator(".pulse-step").count() === 0 && /no longer active/.test(await page.textContent("#tablePulse")), "paid -> refunded while open: timeline removed, truthful 'no longer active'");
  const n = st.polls; await page.clock.runFor(120000); ok(st.polls === n, "stops polling once the payment is refunded"); await page.close(); }
{ const { page, st } = await open({ status: "ready" }); await page.waitForSelector(".pulse-step");
  st.pay = "voided"; await page.clock.runFor(26000); await page.waitForSelector(".pulse-inactive"); ok(true, "paid -> voided: same truthful state"); await page.close(); }
{ const { page } = await open({ status: "cancelled" }); await page.waitForTimeout(300);
  ok(await page.locator("#tablePulse").isHidden(), "no open paid order at load (cancelled earlier): nothing shown, nothing invented"); await page.close(); }
{ const { page } = await open({ failAll: true }); await page.waitForSelector(".pulse-error");
  ok(/Status unavailable right now/.test(await page.textContent("#tablePulse")) && await page.locator(".pulse-step").count() === 0, "network/server error: explicit message, never 'Received'"); await page.close(); }
{ const { page, st } = await open({ status: "accepted" }); await page.waitForSelector(".pulse-step");
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); });
  const n = st.polls; await page.clock.runFor(80000); ok(st.polls === n, "hidden tab: no polling"); await page.close(); }
{ const { page } = await open({ w: 320 }); await page.waitForSelector(".pulse-step");
  // This branch predates #37 (site-wide Arabic); simulate the Arabic page attributes #37 sets.
  await page.evaluate(() => { document.documentElement.dir = "rtl"; document.documentElement.lang = "ar"; }); await page.waitForTimeout(100);
  ok(/قبله المطبخ/.test(await page.textContent("#tablePulse")) && !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), "Arabic strings, RTL, 320px without overflow"); await page.close(); }
{ const { page } = await open({ lang: "fr" }); await page.waitForSelector(".pulse-step"); ok(/Acceptée par la cuisine/.test(await page.textContent("#tablePulse")), "French"); await page.close(); }
{ const { page, st } = await open({ signedIn: false }); await page.waitForTimeout(400); ok(await page.locator("#tablePulse").isHidden() && st.polls === 0, "signed out: hidden, no request"); await page.close(); }
{ const page = await b.newPage(); await page.goto(`http://localhost:${port}/member.html`); await page.waitForTimeout(300); ok(await page.locator("#tablePulse").count() === 0, "inert with null config (demo mode)"); await page.close(); }
await b.close(); srv.close(); console.log(fails ? `${fails} failed` : "all passed"); process.exit(fails ? 1 : 0);
