// Browser check for table booking with a FAKE Supabase. Run: node tests/reserve.browser.mjs
import { createRequire } from "node:module"; import http from "node:http"; import { readFileSync, existsSync } from "node:fs"; import { join, extname } from "node:path";
const require = createRequire(process.env.NODE_PATH ? join(process.env.NODE_PATH, "x") : import.meta.url); const { chromium } = require("playwright");
const root = new URL("..", import.meta.url).pathname; const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };
const srv = http.createServer((q, r) => { const p = join(root, decodeURIComponent(q.url.split("?")[0])); if (!existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": T[extname(p)] || "application/octet-stream" }); r.end(readFileSync(p)); }).listen(0);
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
const b = await chromium.launch(); const port = srv.address().port;
async function open(lang = "en") {
  const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  await page.clock.setFixedTime(new Date("2026-11-26T15:00:00Z"));
  const sent = []; let full = true;
  await page.route("**/supabase-config.js*", (r) => r.fulfill({ contentType: "text/javascript", body: 'window.AZAL_SUPABASE=Object.freeze({url:"https://fake.supabase.co",anonKey:"anon"});' }));
  await page.route("https://fake.supabase.co/**", async (r) => {
    const u = r.request().url(), bd = r.request().postDataJSON(); sent.push({ fn: u.split("/rpc/")[1], bd });
    if (u.endsWith("reservation_availability")) return r.fulfill({ json: bd.p_party > 8 ? [] : [{ starts_at: "2026-11-27T23:00:00Z", seats_left: 20 }, { starts_at: "2026-11-27T23:30:00Z", seats_left: 6 }, { starts_at: "2026-11-28T00:00:00Z", seats_left: 50 }] });
    if (u.endsWith("reserve_table")) { if (full && bd.p_starts_at === "2026-11-27T23:00:00Z") { full = false; return r.fulfill({ status: 400, json: { message: "slot_full" } }); } return r.fulfill({ json: { reservation_id: "r1", code: bd.p_name === "Inject" ? "<img src=x onerror=window.__xss=1>" : "K7PQ2XMA", starts_at: bd.p_starts_at, party_size: bd.p_party, status: "confirmed" } }); }
    if (u.endsWith("cancel_reservation")) return r.fulfill({ json: bd.p_code === "K7PQ2XMA" ? { code: "K7PQ2XMA", status: "cancelled" } : { status: "not_found" } });
    return r.fulfill({ status: 404, json: {} });
  });
  await page.route("**/reservation-config.js*", async (r) => { const body = (await (await r.fetch()).text()).replace("bookingEnabled: false", "bookingEnabled: true").replace("goLiveAuthorized: false", "goLiveAuthorized: true"); r.fulfill({ contentType: "text/javascript", body }); });
  await page.addInitScript((l) => localStorage.setItem("azal-language", l), lang);
  await page.goto(`http://localhost:${port}/reserve.html`);
  await page.waitForSelector(".rs-slot");
  return { page, sent };
}
{
  const { page, sent } = await open();
  ok(await page.locator("[data-i18n='reserveNotice']").isHidden(), "'booking is not open' notice hidden when live");
  ok(await page.locator(".reserve-form input, .reserve-form select").count() === 5, "exactly 5 inputs + time choice: party, date, name, mobile, email");
  ok(await page.locator(".reserve-form textarea, .reserve-form [id*=note], .reserve-form [id*=card]").count() === 0, "no note, card or menu field in the form");
  ok(await page.locator(".rs-slot").count() === 3, "times come from reservation_availability");
  await page.click("#rsSubmit");
  ok(/Choose a time/.test(await page.textContent("#rsError")) && !sent.some((s) => s.fn === "reserve_table"), "no time chosen: nothing sent");
  await page.click(".rs-slot >> nth=0");
  await page.fill("#rsName", "Sara"); await page.fill("#rsEmail", "sara@example.com"); await page.fill("#rsPhone", "555-0101");
  await page.click("#rsSubmit");
  ok(/mobile number/.test(await page.textContent("#rsError")) && !sent.some((s) => s.fn === "reserve_table"), "short phone refused before sending");
  await page.fill("#rsPhone", "343 555 0101"); await page.selectOption("#rsParty", "4"); await page.waitForSelector(".rs-slot");
  await page.click(".rs-slot >> nth=0"); await page.click("#rsSubmit");
  await page.waitForFunction(() => /filled up/.test(document.getElementById("rsError").textContent));
  ok(true, "slot_full shows a clear message and reloads times");
  await page.waitForSelector(".rs-slot"); await page.click(".rs-slot >> nth=1"); await page.click("#rsSubmit");
  await page.waitForSelector("#reserveDone:not([hidden])");
  const txt = await page.textContent("#reserveDone");
  ok(!/\.\./.test(txt), "no doubled period after p.m."); ok(/table for 4/.test(txt) && /K7PQ2XMA/.test(txt) && /sara@example\.com/.test(txt), "confirmation shows party, code and email");
  ok(!/sent to|envoyée/.test(txt) && /saved/.test(txt), "no false 'email sent' claim; says the booking is saved");
  const rq = sent.filter((s) => s.fn === "reserve_table");
  ok(rq.length === 2 && rq[1].bd.p_phone === "+13435550101" && !/note|item|pay|card/.test(JSON.stringify(rq)), "two requests (full, then booked), phone normalised, no food/payment data");
  await page.screenshot({ path: process.env.SHOT || "/tmp/reserve-done.png", fullPage: false });
  await page.click("#rcTitle"); await page.fill("#rcCode", "k7pq2xma"); await page.fill("#rcEmail", "sara@example.com"); await page.click("#rcSubmit");
  await page.waitForFunction(() => /cancelled/.test(document.getElementById("rcMsg").textContent));
  ok(true, "cancel with code + email");
  await page.fill("#rcCode", "ZZZZZZZZ"); await page.click("#rcSubmit"); await page.waitForFunction(() => /couldn’t find/.test(document.getElementById("rcMsg").textContent));
  ok(true, "wrong code: 'not found' message (server returns status, not an error)");
  // XSS regression: markup in the email never reaches the server; markup coming back from the server renders as text.
  await page.click("#rsAnother").catch(() => {});
  await page.waitForSelector("#reserveForm:not([hidden]) .rs-slot");
  const before = sent.filter((s) => s.fn === "reserve_table").length;
  await page.click(".rs-slot >> nth=2"); await page.fill("#rsName", "Inject"); await page.fill("#rsPhone", "3435550101");
  await page.fill("#rsEmail", "<svg/onload=window.__xss=1>@example.com"); await page.click("#rsSubmit");
  ok(sent.filter((s) => s.fn === "reserve_table").length === before && /check your email/.test(await page.textContent("#rsError")), "markup email refused in the browser, nothing sent");
  await page.fill("#rsEmail", "inject@example.com"); await page.click("#rsSubmit"); await page.waitForSelector("#reserveDone:not([hidden])");
  ok(await page.evaluate(() => !window.__xss && document.querySelectorAll("#reserveDone img, #reserveDone svg").length === 0 && /<img src=x/.test(document.getElementById("reserveDone").textContent)), "server value with markup is shown literally, no element created, no script ran");
  await page.selectOption("#rsParty", "9").catch(() => {});
  await page.close();
}
{
  const { page } = await open("fr");
  ok(/Combien de personnes \?/.test(await page.textContent("label[for=rsParty]")) && /Téléphone mobile/.test(await page.textContent("label[for=rsPhone]")), "French labels with non-breaking spaces");
  await page.selectOption("#rsParty", "9"); await page.waitForFunction(() => /Aucune table/.test(document.getElementById("rsSlotMsg").textContent));
  ok(true, "no slots: clear FR message");
  await page.close();
}
{ const { page } = await open("ar");
  ok(/كم شخصاً؟/.test(await page.textContent("label[for=rsParty]")) && /رقم الجوال/.test(await page.textContent("label[for=rsPhone]")) && await page.evaluate(() => document.documentElement.dir) === "rtl" && !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), "Arabic labels, RTL, no overflow");
  await page.close(); }
{ // shared Supabase config present (sign-in/ordering live) but booking flags false: page stays inert, nothing is called
  const page = await b.newPage(); const calls = [];
  await page.route("**/supabase-config.js*", (r) => r.fulfill({ contentType: "text/javascript", body: 'window.AZAL_SUPABASE=Object.freeze({url:"https://fake.supabase.co",anonKey:"anon"});' }));
  await page.route("https://fake.supabase.co/**", (r) => { calls.push(r.request().url()); r.fulfill({ json: [] }); });
  await page.goto(`http://localhost:${port}/reserve.html`); await page.waitForTimeout(400);
  ok(await page.locator("#reserveForm").count() === 0 && calls.filter((u) => /reserv/.test(u)).length === 0 && await page.locator("[data-i18n='reserveNotice']").isVisible(), "Supabase config on + booking flags false: no form, no booking call, notice stays");
  await page.close();
}
{ const page = await b.newPage(); await page.goto(`http://localhost:${port}/reserve.html`); await page.waitForTimeout(300);
  ok(await page.locator("#reserveForm").count() === 0 && await page.locator("[data-i18n='reserveNotice']").isVisible(), "inert with shipped null config: notice stays, no form"); await page.close(); }
await b.close(); srv.close(); console.log(fails ? `${fails} failed` : "all passed"); process.exit(fails ? 1 : 0);
