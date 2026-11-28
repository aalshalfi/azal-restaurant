// Browser check for the kitchen screen with a FAKE Supabase. Run: node tests/staff.browser.mjs
import { createRequire } from "node:module"; import http from "node:http"; import { readFileSync, existsSync } from "node:fs"; import { join, extname } from "node:path";
import { nullConfig } from "./null-config.mjs";
const require = createRequire(process.env.NODE_PATH ? join(process.env.NODE_PATH, "x") : import.meta.url); const { chromium } = require("playwright");
const root = new URL("..", import.meta.url).pathname; const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };
const srv = http.createServer((q, r) => { const p = join(root, decodeURIComponent(q.url.split("?")[0])); if (!existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": T[extname(p)] || "application/octet-stream" }); r.end(readFileSync(p)); }).listen(0);
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
const b = nullConfig(await chromium.launch()); const port = srv.address().port;
async function open({ staff = true, session = true, clash = false, scheduled = false, branches = ["ottawa"] }) {
  const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  const orders = [
    { id: "aaaaaa11-0000-4000-8000-000000000001", pickup_slot: "2026-11-26T17:15:00Z", guest_name: "Sara", customer_note: "Less spice", fulfilment_status: "placed", branch_slug: "ottawa", total_cents: 6325, order_items: [{ quantity: 2, item_name_en_snapshot: "Lamb Mandi", item_name_fr_snapshot: "Mandi d’agneau" }] },
    { id: "bbbbbb22-0000-4000-8000-000000000002", pickup_slot: "2026-11-26T17:15:00Z", guest_name: null, customer_note: null, fulfilment_status: "ready", branch_slug: "ottawa", total_cents: 451, order_items: [{ quantity: 1, item_name_en_snapshot: "Adeni Chai", item_name_fr_snapshot: "Thé adéni" }] }
  ];
  // V8: same first 8 hex as Sara's order -> same pickup sigil
  if (clash) orders.push({ id: "aaaaaa11-9999-4000-8000-000000000003", pickup_slot: "2026-11-26T17:30:00Z", guest_name: "Omar", customer_note: null, fulfilment_status: "placed", branch_slug: "ottawa", total_cents: 999, order_items: [{ quantity: 1, item_name_en_snapshot: "Adeni Chai", item_name_fr_snapshot: "Thé adéni" }] });
  if (branches.includes("second")) orders.push({ id:"cccccc33-0000-4000-8000-000000000003", pickup_slot:"2026-11-26T18:00:00Z", guest_name:"Second branch", customer_note:null, fulfilment_status:"placed", branch_slug:"second", total_cents:700, order_items:[{quantity:1,item_name_en_snapshot:"Second Branch Dish",item_name_fr_snapshot:"Plat deuxième succursale"}] });
  if (scheduled) orders.push({ id:"dddddd44-0000-4000-8000-000000000004", pickup_slot:new Date(Date.now()+3600000).toISOString(), scheduled_for:new Date(Date.now()+3600000).toISOString(), guest_name:"Future pickup", customer_note:null, fulfilment_status:"placed", branch_slug:"ottawa", total_cents:850, order_items:[{quantity:1,item_name_en_snapshot:"Future dish",item_name_fr_snapshot:"Plat futur"}] });
  const acts = [], requests = [], summaryCalls = [];
  await page.route("**/supabase-config.js*", (r) => r.fulfill({ contentType: "text/javascript", body: 'window.AZAL_SUPABASE=Object.freeze({url:"https://fake.supabase.co",anonKey:"anon"});' }));
  await page.route("https://fake.supabase.co/**", async (r) => {
    const u = r.request().url();
    if (u.includes("azal_staff_my_branches")) return r.fulfill({ json: branches });
    if (u.includes("azal_staff_can_access")) return r.fulfill({ json: staff });
    if (u.includes("azal_staff_today_summary")) { summaryCalls.push(u); return r.fulfill({ json: { local_date:"2026-11-28", order_count:4, placed_count:1, accepted_count:0, preparing_count:1, ready_count:1, collected_count:1, cancelled_count:0, net_collected_cents:6775 } }); }
    if (u.includes("/rest/v1/orders")) {
      requests.push(u);
      const match = u.match(/[?&]branch_slug=eq\.([^&]+)/);
      const selected = match ? decodeURIComponent(match[1]) : "";
      if (u.includes("fulfilment_status=in.")) {
        const now = new Date();
        const history = [
          { id:"eeeeee55-0000-4000-8000-000000000005", placed_at:new Date(now.getTime()-3600000).toISOString(), fulfilment_status:"handed_over", branch_slug:"ottawa", order_items:[{quantity:1,item_name_en_snapshot:"Completed Mandi",item_name_fr_snapshot:"Mandi terminée"}] },
          { id:"ffffff66-0000-4000-8000-000000000006", placed_at:new Date(now.getTime()-7200000).toISOString(), fulfilment_status:"cancelled", branch_slug:"ottawa", order_items:[{quantity:1,item_name_en_snapshot:"Cancelled Chai",item_name_fr_snapshot:"Thé annulé"}] }
        ];
        return r.fulfill({ json: history.filter(o=>!selected||o.branch_slug===selected) });
      }
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
  ok(await page.locator(".staff-shell-nav a").count() === 2 && /Queue/.test(await page.textContent(".staff-shell-nav")) && /History/.test(await page.textContent(".staff-shell-nav")), "T-28 shows Queue and History, with no dead Availability or Settings destination");
  ok(await page.locator(".staff-stage-chip").count() === 4, "Queue has All / New / Preparing / Ready stage chips");
  await page.locator(".staff-stage-chip[data-stage='ready']").click();
  ok(await page.locator("#staffScreen-queue .staff-order").count() === 1 && /Ready/.test(await page.textContent("#staffScreen-queue")), "stage chip filters the live queue");
  await page.locator(".staff-stage-chip[data-stage='all']").click();
  await page.locator(".staff-shell-nav a[href='#history']").click();
  ok(summaryCalls.length===0, "Queue does not poll or fetch the History-only T-26 summary");
  ok(/Today's summary/.test(await page.textContent("#staffScreen-history")) && /\$67\.75/.test(await page.textContent("#staffScreen-history")) && await page.locator("#staffCopySummary").count() === 1, "History shows T-26 net collected total and manual-copy action");
  await page.waitForFunction(()=>document.querySelectorAll("#staffScreen-history .staff-history-order").length===2);
  ok(/Completed Mandi/.test(await page.textContent("#staffScreen-history"))&&/Cancelled Chai/.test(await page.textContent("#staffScreen-history"))&&/Handed over/.test(await page.textContent("#staffScreen-history"))&&/Cancelled/.test(await page.textContent("#staffScreen-history")), "History lists today's completed and cancelled branch tickets");
  ok(!/Sara|Future pickup|contact_phone/.test(await page.textContent("#staffScreen-history")), "History omits guest identity and contact details");
  ok(summaryCalls.length===1&&requests.some(u=>u.includes("fulfilment_status=in.")&&u.includes("placed_at=gte.")&&u.includes("placed_at=lt.")), "History loads its summary and Toronto-day terminal orders only on entry");
  ok(!/HST|Tax|TVH|ضريبة/.test(await page.textContent("#staffScreen-history")), "Staff summary contains no tax breakdown");
  await page.locator(".staff-shell-nav a[href='#queue']").click();
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


{
  const { page } = await open({ scheduled: true });
  await page.waitForSelector(".staff-order");
  ok(await page.locator(".staff-shell-nav a[data-staff-view='scheduled']").count() === 1, "Scheduled destination appears only when a future order exists");
  await page.locator(".staff-shell-nav a[href='#scheduled']").click();
  ok(/Future dish/.test(await page.textContent("#staffScreen-scheduled")), "Scheduled screen owns future pickup tickets");
  await page.close();
}

await b.close(); srv.close(); console.log(fails ? `${fails} failed` : "all passed"); process.exit(fails ? 1 : 0);
