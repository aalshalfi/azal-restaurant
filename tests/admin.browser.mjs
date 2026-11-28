// ADM-1 (owner F-OWN-10/13: "admin sign-in lands on the plain customer view"): one door, role-routed. FAKE Supabase.
// Member page: admin gets a Management panel, staff the kitchen link, customers nothing extra. admin.html: admin sees
// the read-only overview; staff and customers are told plainly and shown no data; signed out goes to sign in.
// Run: node tests/admin.browser.mjs
import { createRequire } from "node:module"; import http from "node:http"; import { readFileSync, existsSync } from "node:fs"; import { join, extname } from "node:path";
import { nullConfig } from "./null-config.mjs";
const require = createRequire(process.env.NODE_PATH ? join(process.env.NODE_PATH, "x") : import.meta.url); const { chromium } = require("playwright");
const root = new URL("..", import.meta.url).pathname; const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2" };
const srv = http.createServer((q, r) => { const p = join(root, decodeURIComponent(q.url.split("?")[0])); if (!existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": T[extname(p)] || "application/octet-stream" }); r.end(readFileSync(p)); }).listen(0);
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
const b = nullConfig(await chromium.launch()); const base = `http://localhost:${srv.address().port}`;
const ORDERS = [
  { id: "1", branch_slug: "ottawa", fulfilment_status: "placed", payment_status: "paid", total_cents: 2824 },
  { id: "2", branch_slug: "ottawa", fulfilment_status: "handed_over", payment_status: "paid", total_cents: 2259 },
  { id: "3", branch_slug: "ottawa", fulfilment_status: "placed", payment_status: "unpaid", total_cents: 677 }];

async function open(pageName, { role = "admin", signedIn = true, lang = "en", w = 390 } = {}) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } }); const sent = [];
  await p.route("**/supabase-config.js*", (r) => r.fulfill({ contentType: "text/javascript", body: 'window.AZAL_SUPABASE=Object.freeze({url:"https://fake.supabase.co",anonKey:"anon"});' }));
  await p.route("https://fake.supabase.co/**", (r) => {
    const req = r.request(), u = decodeURIComponent(req.url()); sent.push({ u, m: req.method() });
    if (u.includes("/rpc/azal_is_admin")) return r.fulfill({ json: role === "admin" });
    if (u.includes("/rest/v1/user_roles")) return r.fulfill({ json: role === "customer" ? [] : [{ role }] });
    if (u.includes("/rest/v1/staff_branch_access")) return r.fulfill({ json: role === "staff" ? [{ branch_slug: "ottawa" }] : [] });
    if (u.includes("/rest/v1/orders")) return r.fulfill({ json: role === "admin" ? ORDERS : [] });
    if (u.includes("/rest/v1/memberships") && u.includes("status=eq.active")) return r.fulfill({ json: [{ user_id: "x" }], headers: { "content-range": "0-0/42", "access-control-expose-headers": "content-range" } });
    if (u.includes("/rest/v1/profiles")) return r.fulfill({ json: [{ id: "u1", display_name: "Owner" }] });
    if (u.includes("/rest/v1/memberships")) return r.fulfill({ json: [{ status: "active" }] });
    if (u.includes("/rest/v1/points_ledger")) return r.fulfill({ json: [] });
    if (u.includes("claim_guest_points")) return r.fulfill({ json: { points_added: 0 } });
    return r.fulfill({ status: 404, json: {} });
  });
  await p.addInitScript(([l, s]) => { localStorage.setItem("azal-language", l); if (s) localStorage.setItem("azal-auth-v1", JSON.stringify({ access_token: "T", refresh_token: "R", expires_at: 4e12, user: { id: "u1", email: "info@example.invalid" } })); }, [lang, signedIn]);
  await p.goto(`${base}/${pageName}.html`); await p.waitForTimeout(500);
  return { p, sent };
}

{ const { p } = await open("member");
  await p.waitForURL(/admin\.html(?:#.*)?$/, { timeout: 5000 }).catch(() => {});
  ok(/admin\.html(?:#.*)?$/.test(p.url()), "member page, admin: sent straight to the management area (owner: never the customer account)");
  await p.waitForTimeout(400);
  ok(/Collected sales today/.test(await p.textContent("#adminRoot")) && await p.locator(".member-card, #memberHistory").count() === 0, "admin lands on management only: no customer card, history or points");
  await p.close(); }
{ const { p } = await open("member", { role: "staff" });
  await p.waitForURL(/staff\.html$/, { timeout: 5000 }).catch(() => {});
  ok(/staff\.html$/.test(p.url()), "member page, staff: sent straight to the kitchen screen");
  await p.close(); }
{ const { p } = await open("member", { role: "customer" });
  await p.waitForTimeout(300);
  ok(/member\.html$/.test(p.url()) && await p.locator("#roleDoor").isHidden() && await p.locator("#roleDoor a").count() === 0, "member page, customer: stays, no admin controls");
  await p.evaluate(() => document.documentElement.classList.add("role-leaving"));
  ok(await p.evaluate(() => getComputedStyle(document.querySelector(".member-card")).visibility) === "hidden", "while a staff/admin sign-in is leaving (role-leaving), the customer card is not visible");
  await p.close(); }
{ const { p, sent } = await open("admin");
  const t = (await p.textContent("#adminRoot")).replace(/\s+/g, " ");
  ok(/Signed in as info@example\.invalid · Administrator/.test(t), "admin page: who and which role");
  ok(/New, paid ?1/.test(t) && /Collected ?1/.test(t) && /Unpaid \(never reach the kitchen\) ?1/.test(t) && /Collected sales today: \$22\.59/.test(t) && /Active Majlis members: 42/.test(t), "overview: today's counts, collected sales, member count from the server");
  ok(/ottawa: 3 orders today, 1 collected/.test(t), "per-branch line");
  const destinations = await p.locator("#adminRoot .admin-shell-link").allTextContents();
  ok(["Home","Orders","Customers","Reports","More"].every(x => destinations.includes(x)), "T-27 Admin shell exposes exactly the five adjudicated destinations");
  ok(!/Menu|Availability/.test(destinations.join(" ")), "no dead Menu or Availability destination before T-21/T-29");
  const attentionDebug = await p.locator('#adminScreen-orders [data-order-card="1"]').evaluateAll(cards=>cards.map(c=>({status:c.dataset.status,payment:c.dataset.paymentStatus,code:c.dataset.orderCode})));
  console.log("T27 attention diagnostic", attentionDebug, "links", await p.locator("#adminScreen-home .admin-needs-attention .admin-more-link").count());
  ok(await p.locator("#adminScreen-home .admin-needs-attention .admin-more-link").count() === 1, "Needs attention includes paid actionable orders only, not unpaid orders");
  const homeHidden = await p.locator("#adminScreen-home").getAttribute("hidden");
  const ordersHidden = await p.locator("#adminScreen-orders").getAttribute("hidden");
  const homeCurrent = await p.locator('.admin-shell-link[href="#home"]').getAttribute("aria-current");
  console.log("T27 route diagnostic", { url:p.url(), hash:await p.evaluate(()=>location.hash), homeHidden, ordersHidden, homeCurrent });
  ok(homeHidden === null && ordersHidden !== null && homeCurrent === "page", "Admin shell opens Home first and keeps other screens out of the active view");
  await p.locator('.admin-shell-nav a[href="#reports"]').click();
  ok(await p.locator("#adminScreen-reports").isVisible(), "Reports destination opens as its own screen");
  const postReads = ["/rpc/azal_is_admin", "/rpc/azal_admin_customer_directory_page", "/rpc/azal_admin_team_list", "/rpc/azal_admin_audit_recent", "/rpc/azal_admin_order_customer_emails", "/rpc/azal_admin_customer_contact"];
  ok(sent.every((s) => s.m === "GET" || (s.m === "POST" && postReads.some((path) => s.u.includes(path)))), "Admin page boot only calls read-only RPCs; no mutation endpoint runs automatically");
  ok(!sent.some((s) => s.u.includes("/rpc/azal_admin_customer_contact") || s.u.includes("/rpc/azal_admin_order_customer_emails")), "Admin boot does not fetch customer contact; lookup stays detail-only");
  const ord = sent.find((s) => s.u.includes("/rest/v1/orders")); ok(ord && /placed_at=gte\.\d{4}-\d\d-\d\dT0[45]:00:00\.000Z/.test(ord.u), "today = since Toronto midnight");
  await p.close(); }
{ const { p, sent } = await open("admin", { role: "staff" });
  ok(/doesn’t have access/.test(await p.textContent("#adminRoot")) && await p.getAttribute("#adminRoot a.button", "href") === "staff.html" && !sent.some((s) => s.u.includes("/rest/v1/orders")), "admin page as staff: told plainly, sent to the kitchen screen, no order data requested");
  await p.close(); }
{ const { p, sent } = await open("admin", { role: "customer" });
  ok(/doesn’t have access/.test(await p.textContent("#adminRoot")) && await p.locator("#adminRoot a.button").count() === 0 && !sent.some((s) => s.u.includes("/rest/v1/orders")), "admin page as a customer: no access, no data, no buttons");
  await p.close(); }
{ const { p } = await open("admin", { signedIn: false });
  ok(/Sign in first/.test(await p.textContent("#adminRoot")) && await p.getAttribute("#adminRoot a.button", "href") === "member.html", "admin page signed out: points to the one sign-in door");
  await p.close(); }
{ const { p } = await open("admin", { lang: "ar", w: 320 });
  const t = await p.textContent("#adminRoot");
  ok(/مدير/.test(t) && /جديدة ومدفوعة/.test(t) && /⁦/.test(t), "Arabic overview, prices isolated");
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Arabic at 320px: no horizontal scroll");
  await p.close(); }
{ // ChatGPT #62 review: a sign-out in ANOTHER tab wipes the counts here at once
  const ctx = await b.newContext({ viewport: { width: 390, height: 900 } });
  await ctx.route("**/supabase-config.js*", (r) => r.fulfill({ contentType: "text/javascript", body: 'window.AZAL_SUPABASE=Object.freeze({url:"https://fake.supabase.co",anonKey:"anon"});' }));
  await ctx.route("https://fake.supabase.co/**", (r) => { const u = decodeURIComponent(r.request().url());
    if (u.includes("/rpc/azal_is_admin")) return r.fulfill({ json: true });
    if (u.includes("/rest/v1/user_roles")) return r.fulfill({ json: [{ role: "admin" }] });
    if (u.includes("/rest/v1/staff_branch_access")) return r.fulfill({ json: [] });
    if (u.includes("/rest/v1/orders")) return r.fulfill({ json: ORDERS });
    if (u.includes("/rest/v1/memberships")) return r.fulfill({ json: [], headers: { "content-range": "0-0/42", "access-control-expose-headers": "content-range" } });
    return r.fulfill({ status: 404, json: {} }); });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); if (!localStorage.getItem("azal-auth-v1") && !localStorage.getItem("signed-out")) localStorage.setItem("azal-auth-v1", JSON.stringify({ access_token: "T", refresh_token: "R", expires_at: 4e12, user: { id: "u1", email: "info@example.invalid" } })); } });
  const a = await ctx.newPage(); await a.goto(`${base}/admin.html`); await a.waitForTimeout(500);
  ok(/Collected sales today/.test(await a.textContent("#adminRoot")), "tab A shows the overview");
  const t2 = await ctx.newPage(); await t2.goto(`${base}/index.html`);
  await t2.evaluate(() => { localStorage.setItem("signed-out", "1"); localStorage.removeItem("azal-auth-v1"); });
  await a.waitForTimeout(600);
  const t = await a.textContent("#adminRoot");
  ok(!/Collected sales|42|ottawa/.test(t) && /Sign in first/.test(t), "signed out in tab B: tab A drops every number and asks to sign in");
  await ctx.close();
}
{ // an overview that answers after a sign-out is discarded
  const { p } = await open("admin");
  let release; const hold = new Promise((r) => (release = r));
  await p.route("https://fake.supabase.co/rest/v1/orders**", (r) => hold.then(() => r.fulfill({ json: ORDERS })));
  await p.evaluate(() => document.dispatchEvent(new Event("visibilitychange"))); await p.waitForTimeout(200);
  await p.evaluate(() => { localStorage.removeItem("azal-auth-v1"); document.dispatchEvent(new CustomEvent("azal:auth", { detail: { status: "signed_out" } })); });
  await p.waitForTimeout(200); release(); await p.waitForTimeout(500);
  const t = await p.textContent("#adminRoot");
  ok(!/Collected sales|ottawa/.test(t) && /Sign in first/.test(t), "late overview after sign-out: never painted");
  await p.close();
}
await b.close(); srv.close(); if (fails) { console.log(fails + " failed"); process.exit(1); } else console.log("all passed");
