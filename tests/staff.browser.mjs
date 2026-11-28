// Browser check for the kitchen screen with a FAKE Supabase. Run: node tests/staff.browser.mjs
import { createRequire } from "node:module"; import http from "node:http"; import { readFileSync, existsSync } from "node:fs"; import { join, extname } from "node:path";
import { nullConfig } from "./null-config.mjs";
const require = createRequire(process.env.NODE_PATH ? join(process.env.NODE_PATH, "x") : import.meta.url); const { chromium } = require("playwright");
const root = new URL("..", import.meta.url).pathname; const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };
const srv = http.createServer((q, r) => { const p = join(root, decodeURIComponent(q.url.split("?")[0])); if (!existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": T[extname(p)] || "application/octet-stream" }); r.end(readFileSync(p)); }).listen(0);
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
const b = nullConfig(await chromium.launch()); const port = srv.address().port;
async function open({ staff = true, session = true, clash = false, branches = ["ottawa"] }) {
  const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  const orders = [
    { id: "aaaaaa11-0000-4000-8000-000000000001", pickup_slot: "2026-11-26T17:15:00Z", guest_name: "Sara", customer_note: "Less spice", fulfilment_status: "placed", branch_slug: "ottawa", total_cents: 6325, order_items: [{ quantity: 2, item_name_en_snapshot: "Lamb Mandi", item_name_fr_snapshot: "Mandi d’agneau" }] },
    { id: "bbbbbb22-0000-4000-8000-000000000002", pickup_slot: "2026-11-26T17:15:00Z", guest_name: null, customer_note: null, fulfilment_status: "ready", branch_slug: "ottawa", total_cents: 451, order_items: [{ quantity: 1, item_name_en_snapshot: "Adeni Chai", item_name_fr_snapshot: "Thé adéni" }] }
  ];
  // V8: same first 8 hex as Sara's order -> same pickup sigil
  if (clash) orders.push({ id: "aaaaaa11-9999-4000-8000-000000000003", pickup_slot: "2026-11-26T17:30:00Z", guest_name: "Omar", customer_note: null, fulfilment_status: "placed", branch_slug: "ottawa", total_cents: 999, order_items: [{ quantity: 1, item_name_en_snapshot: "Adeni Chai", item_name_fr_snapshot: "Thé adéni" }] });
  if (branches.includes("second")) orders.push({ id:"cccccc33-0000-4000-8000-000000000003", pickup_slot:"2026-11-26T18:00:00Z", guest_name:"Second branch", customer_note:null, fulfilment_status:"placed", branch_slug:"second", total_cents:700, order_items:[{quantity:1,item_name_en_snapshot:"Second Branch Dish",item_name_fr_snapshot:"Plat deuxième succursale"}] });
  const acts = [], requests = [];
  await page.route("**/supabase-config.js*", (r) => r.fulfill({ contentType: "text/javascript", body: 'window.AZAL_SUPABASE=Object.freeze({url:"https://fake.supabase.co",anonKey:"anon"});' }));
  await page.route("https://fake.supabase.co/**", async (r) => {
    const u = r.request().url();
    if (u.includes("azal_staff_my_branches")) return r.fulfill({ json: branches });
    if (u.includes("azal_staff_can_access")) return r.fulfill({ json: staff });
    if (u.includes("/rest/v1/orders")) {
      requests.push(u);
      const match = u.match(/[?&]branch_slug=eq\.([^&]+)/);
      const selected = match ? decodeURIComponent(match[1]) : "";
      return r.fulfill({ json: orders.filter((o) => (!selected || o.branch_slug === selected) && !["handed_over", "cancelled"].includes(o.fulfilment_status)) });
    }
    if (u.includes("staff_update_order")) { const bd = r.request().postDataJSON(); acts.push(bd); const o = orders.find((x) => x.id === bd.p_order); o.fulfilment_status = { accept: "accepted", ready: "ready", hand_over: "handed_over" }[bd.p_action]; return r.fulfill({ json: { order_id: o.id, fulfilment_status: o.fulfilment_status } }); }
    if (u.includes("/auth/v1/")) return r.fulfill({ status: 401, json: {} });
    return r.fulfill({ status: 404, json: {} });
  });
  if (session) await page.addInitScript(() => localStorage.setItem("azal-auth-v1", JSON.stringify({ access_token: "STAFF", refresh_token: "R", expires_at: 4e12, user: { id: "s1", email: "staff@example.invalid" } })));
  await page.goto(`http://localhost:${port}/staff.html`);
  return { page, acts, requests };
}
{
  const { page, acts } = await open({});
  await page.waitForSelector(".staff-order");
  ok(await page.locator(".staff-slot").count() === 1 && await page.locator(".staff-order").count() === 2, "two paid orders grouped under one pickup slot");
  ok(/AAAAAA/.test(await page.textContent(".staff-order.is-placed .staff-code")) && /Less spice/.test(await page.textContent(".staff-order.is-placed")), "code, guest name and kitchen note shown");
  const Sig = require(join(root, "sigil.js")), sg = Sig.sigil("aaaaaa11-0000-4000-8000-000000000001");
  ok((await page.textContent(".staff-order.is-placed .staff-sigil")) === sg.icon + " " + sg.num && (await page.textContent(".staff-order.is-placed .staff-sigil-words")) === ["en", "fr", "ar"].map(sg.word).join(" · "), "V8: ticket leads with the sigil, words in EN/FR/AR");
  ok(await page.locator(".staff-order.is-clash").count() === 0, "V8: no clash flag when sigils differ");
  const fs2 = await page.evaluate(() => [parseFloat(getComputedStyle(document.querySelector(".staff-order.is-placed .staff-sigil")).fontSize), parseFloat(getComputedStyle(document.querySelector(".staff-order.is-placed .staff-who")).fontSize)]);
  ok(fs2[0] >= 2 * fs2[1], "V8: the guest name is secondary (sigil at least twice its size)");
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
{ const { page } = await open({}); await page.waitForSelector(".staff-order"); await page.evaluate(() => { document.documentElement.lang = "ar"; }); await page.waitForTimeout(100);
  ok(/طلبات المطبخ/.test(await page.textContent("#staffRoot")) && /قبول/.test(await page.textContent("#staffRoot")), "Arabic kitchen screen"); await page.close(); }
{ const page = await b.newPage(); await page.goto(`http://localhost:${port}/staff.html`); await page.waitForTimeout(300); ok(/turns on when the site is connected/.test(await page.textContent("#staffRoot")), "inert with null config (demo mode)"); await page.close(); }
{ const { page } = await open({ clash: true }); await page.waitForSelector(".staff-order");
  ok(await page.locator(".staff-order.is-clash").count() === 2 && /check the code/.test(await page.textContent(".staff-order.is-clash .staff-clash")), "V8: two active orders sharing a sigil are both flagged");
  await page.close(); }

{
  const { page, requests } = await open({ branches: ["ottawa","second"] });
  await page.waitForSelector(".staff-order");
  ok(await page.locator("#staffBranch").count() === 1, "named staff with multiple assignments gets a branch selector");
  await page.selectOption("#staffBranch","second");
  await page.waitForFunction(() => /Second Branch Dish/.test(document.querySelector("#staffRoot")?.textContent || ""));
  ok(requests.some(u => u.includes("branch_slug=eq.second")), "branch switch reloads only the selected assigned branch");
  ok(!(await page.textContent("#staffRoot")).includes("Lamb Mandi"), "orders from the previous branch disappear after switching");
  await page.close();
}

await b.close(); srv.close(); console.log(fails ? `${fails} failed` : "all passed"); process.exit(fails ? 1 : 0);
