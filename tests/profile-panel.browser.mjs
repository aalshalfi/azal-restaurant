// F-OWN-25 (owner): "Your details" + Sign out live behind the header's profile icon on every page. Signed in: the icon
// opens a panel in place (no navigation). Visitor: the icon is the Majlis link as before. The member page keeps the card,
// orders and points; its permanent details/sign-out block is gone. FAKE Supabase. Run: node tests/profile-panel.browser.mjs
import { createRequire } from "node:module"; import http from "node:http"; import { readFileSync, existsSync } from "node:fs"; import { join, extname } from "node:path";
import { nullConfig } from "./null-config.mjs";
const require = createRequire(process.env.NODE_PATH ? join(process.env.NODE_PATH, "x") : import.meta.url); const { chromium } = require("playwright");
const root = new URL("..", import.meta.url).pathname; const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2" };
const srv = http.createServer((q, r) => { const p = join(root, decodeURIComponent(q.url.split("?")[0])); if (!existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": T[extname(p)] || "application/octet-stream" }); r.end(readFileSync(p)); }).listen(0);
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
const b = nullConfig(await chromium.launch()); const base = `http://localhost:${srv.address().port}`;
async function open(page, { signedIn = true, lang = "en", w = 390 } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: 850 } }); const sent = [];
  await ctx.route("**/supabase-config.js*", (r) => r.fulfill({ contentType: "text/javascript", body: 'window.AZAL_SUPABASE=Object.freeze({url:"https://fake.supabase.co",anonKey:"anon"});' }));
  await ctx.route("https://fake.supabase.co/**", (r) => { const u = decodeURIComponent(r.request().url()); sent.push(u);
    if (u.includes("/rest/v1/profiles")) return r.fulfill({ json: [{ id: "u1", display_name: "Aziz Alshalfi", phone: "+16135550180", member_number: 10001, created_at: "2026-11-20T15:00:00Z" }] });
    if (u.includes("/auth/v1/logout")) return r.fulfill({ status: 204, body: "" });
    if (u.includes("/rpc/azal_is_admin")) return r.fulfill({ json: false });
    if (u.includes("/rest/v1/memberships")) return r.fulfill({ json: [{ status: "active" }] });
    if (u.includes("/rest/v1/points_ledger")) return r.fulfill({ json: [{ delta_points: 2824 }] });
    if (u.includes("/rest/v1/user_roles") || u.includes("/rest/v1/orders")) return r.fulfill({ json: [] });
    return r.fulfill({ status: 404, json: {} }); });
  await ctx.addInitScript(([l, s]) => { localStorage.setItem("azal-language", l); if (s && !sessionStorage.getItem("s")) { sessionStorage.setItem("s", "1"); localStorage.setItem("azal-auth-v1", JSON.stringify({ access_token: "T", refresh_token: "R", expires_at: 4e12, user: { id: "u1", email: "aziz@example.invalid" } })); } }, [lang, signedIn]);
  const p = await ctx.newPage(); await p.goto(`${base}/${page}.html`); await p.waitForTimeout(700);
  return { ctx, p, sent };
}
const icon = ".majlis-quick";
for (const w of [390, 1280]) {
  const { ctx, p } = await open("index", { w }); const url = p.url();
  ok(await p.locator(icon).isVisible(), `@${w}: the profile icon is in the header`);
  await p.click(icon);
  const t = (await p.textContent("#profilePanel")).replace(/\s+/g, " ");
  ok(p.url() === url && await p.locator("#profilePanel").isVisible() && await p.getAttribute(icon, "aria-expanded") === "true", `@${w}: the icon opens the profile panel in place (no navigation)`);
  ok(/Aziz Alshalfi/.test(t) && /\+16135550180/.test(t) && /aziz@example\.invalid/.test(t) && await p.locator("#profilePanel #authEditDetails").isVisible() && await p.locator("#profilePanel #authSignOut").isVisible(), `@${w}: name · mobile · email, Edit my details, and Sign out`);
  ok(await p.getAttribute("#profilePanel .profile-majlis", "href") === "member.html", `@${w}: a way to the member page from other pages`);
  await p.keyboard.press("Escape");
  ok(await p.locator("#profilePanel").isHidden() && await p.evaluate(() => document.activeElement.classList.contains("majlis-quick")) && await p.getAttribute(icon, "aria-expanded") === "false", `@${w}: Escape closes it and returns focus to the icon`);
  await p.click(icon); await p.mouse.click(20, 600);
  ok(await p.locator("#profilePanel").isHidden(), `@${w}: a tap outside closes it`);
  await p.click(icon); await p.click("#authEditDetails"); await p.fill("#pfName", "Typing"); await p.mouse.click(20, 600);
  ok(await p.locator("#profilePanel").isVisible() && await p.inputValue("#pfName") === "Typing", `@${w}: …but not while the member is editing (nothing typed is lost)`);
  await ctx.close();
}
{ const { ctx, p } = await open("member");
  ok(await p.locator(".member-card #authSignOut, .member-card .auth-details").count() === 0, "member page: no permanent details block or sign-out (they are behind the icon)");
  ok(await p.locator(".mcard").isVisible() && await p.locator(".member-card .member-stats").count() === 0, "member page keeps the card; the lone 'Membership: Member' box is gone (the card says it)");
  ok(await p.locator("#profilePanel .profile-majlis").count() === 0 || (await p.click(icon), await p.locator("#profilePanel .profile-majlis").count() === 0), "on the member page itself the panel has no link back to it");
  await ctx.close(); }
{ const { ctx, p, sent } = await open("menu");
  await p.click(icon); await p.click("#authSignOut"); await p.waitForTimeout(500);
  ok(sent.some((u) => u.includes("/auth/v1/logout")) && await p.evaluate(() => localStorage.getItem("azal-auth-v1") === null) && await p.locator("#profilePanel").isHidden(), "Sign out from the panel (menu page): session ended, panel closed");
  ok(await p.getAttribute(icon, "aria-haspopup") === null, "signed out: the icon is a plain link again");
  await p.click(icon); await p.waitForURL(/member\.html$/, { timeout: 5000 }).catch(() => {});
  ok(/member\.html$/.test(p.url()), "…and leads to the Majlis page");
  await ctx.close(); }
{ const { ctx, p } = await open("index", { signedIn: false });
  await p.click(icon); await p.waitForURL(/member\.html$/, { timeout: 5000 }).catch(() => {});
  ok(/member\.html$/.test(p.url()), "visitor: the icon goes to the Majlis page as before");
  await ctx.close(); }
for (const [lang, w, word] of [["ar", 320, "بياناتك"], ["fr", 390, "Vos coordonnées"]]) {
  const { ctx, p } = await open("story", { lang, w });
  await p.click(icon);
  const r = await p.locator("#profilePanel").boundingBox();
  ok((await p.textContent("#profilePanel")).includes(word) && r.x >= 0 && r.x + r.width <= w && await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${lang} @${w}: the panel reads in ${lang} and fits the screen`);
  await ctx.close(); }
for (const [lang, w] of [["fr", 801], ["fr", 900], ["en", 1024], ["ar", 1100]]) { // §6: the narrow-desktop header fits (French overflowed at 801 before)
  const { ctx, p } = await open("index", { lang, w, signedIn: false });
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll(".site-header a, .site-header button")].filter((e) => e.offsetParent).every((e) => { const r = e.getBoundingClientRect(); return r.left >= -0.5 && r.right <= innerWidth + 0.5; })) && await p.locator(".majlis-quick").isVisible() && /Votre commande|Your order|طلبك/.test(await p.textContent("#cartOpen")), `${lang} @${w}: the header fits, with the profile icon; the bag keeps its words for screen readers`);
  await ctx.close(); }
await b.close(); srv.close(); if (fails) { console.log(fails + " failed"); process.exit(1); } else console.log("all passed");
