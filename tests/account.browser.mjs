// F-OWN-1/2/8 (owner first test 2026-11-27): password-first sign-in; joining asks for name + email + mobile + password;
// a signed-in member sees and edits their own name, mobile and email. FAKE Supabase. Run: node tests/account.browser.mjs
import { createRequire } from "node:module"; import http from "node:http"; import { readFileSync, existsSync } from "node:fs"; import { join, extname } from "node:path";
import { nullConfig } from "./null-config.mjs";
const require = createRequire(process.env.NODE_PATH ? join(process.env.NODE_PATH, "x") : import.meta.url); const { chromium } = require("playwright");
const root = new URL("..", import.meta.url).pathname; const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2" };
const srv = http.createServer((q, r) => { const p = join(root, decodeURIComponent(q.url.split("?")[0])); if (!existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": T[extname(p)] || "application/octet-stream" }); r.end(readFileSync(p)); }).listen(0);
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
const b = nullConfig(await chromium.launch()); const base = `http://localhost:${srv.address().port}`;

async function open({ lang = "en", signedIn = false, profile = { id: "u1", display_name: "Amal <b>S</b>", phone: "+13439990001" }, w = 390, hold = null, failEmail = false } = {}) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } }); const sent = [];
  const prof = profile ? { ...profile } : null;
  await p.route("**/supabase-config.js*", (r) => r.fulfill({ contentType: "text/javascript", body: 'window.AZAL_SUPABASE=Object.freeze({url:"https://fake.supabase.co",anonKey:"anon"});' }));
  await p.route("https://fake.supabase.co/**", (r) => {
    const req = r.request(), u = decodeURIComponent(req.url()); let body = null; try { body = req.postDataJSON(); } catch {} sent.push({ u, m: req.method(), body });
    if (u.includes("/auth/v1/signup")) return r.fulfill({ json: { user: { id: "u2", email: body.email } } }); // confirmation on: no session
    if (u.includes("/auth/v1/user") && req.method() === "PUT" && failEmail) return r.fulfill({ status: 422, json: { msg: "Email address is invalid" } });
    if (u.includes("/auth/v1/user") && req.method() === "PUT") return r.fulfill({ json: { id: "u1", email: "m@example.com", new_email: body.email } });
    if (u.includes("/rpc/update_my_profile") && hold) return hold.then(() => r.fulfill({ json: { display_name: body.p_name, phone: body.p_phone } }));
    if (u.includes("/rpc/update_my_profile")) { if (!/^\+1\d{10}$/.test(body.p_phone || "+10000000000")) return r.fulfill({ status: 400, json: { message: "invalid_phone" } }); prof.display_name = body.p_name; prof.phone = body.p_phone; return r.fulfill({ json: { display_name: body.p_name, phone: body.p_phone } }); }
    if (u.includes("/rest/v1/profiles")) return r.fulfill({ json: prof ? [prof] : [] });
    if (u.includes("/rest/v1/memberships")) return r.fulfill({ json: [{ status: "active" }] });
    if (u.includes("/rest/v1/points_ledger")) return r.fulfill({ json: [] });
    if (u.includes("/rest/v1/orders")) return r.fulfill({ json: [] });
    if (u.includes("claim_guest_points")) return r.fulfill({ json: { points_added: 0 } });
    return r.fulfill({ status: 404, json: {} });
  });
  await p.addInitScript(([l, s]) => { localStorage.setItem("azal-language", l); if (s) localStorage.setItem("azal-auth-v1", JSON.stringify({ access_token: "T", refresh_token: "R", expires_at: 4e12, user: { id: "u1", email: "m@example.com" } })); }, [lang, signedIn]);
  await p.goto(base + "/member.html"); await p.waitForTimeout(400);
  return { p, sent };
}
const msg = (p) => p.evaluate(() => (document.getElementById("authMessage") || document.getElementById("pfMessage") || {}).textContent || "");

{ // F-OWN-1: password first
  const { p } = await open();
  ok(await p.locator("#authForm #authEmail").isVisible() && await p.locator("#authForm #authPassword").isVisible() && await p.locator("#authCodeRequest").count() === 0, "signed out: the email + password form is what opens first");
  ok(/email link instead/.test(await p.textContent("#authUseCode")), "the email link stays one tap away");
  await p.click("#authUseCode"); ok(await p.locator("#authCodeRequest").isVisible(), "…and it still works");
  await p.close();
}
{ // F-OWN-2: joining asks for name, email, mobile, password; validated before anything is sent
  const { p, sent } = await open();
  await p.click("#authSwitch");
  ok(await p.locator("#authName").isVisible() && await p.locator("#authPhone").isVisible() && await p.getAttribute("#authPhone", "type") === "tel" && await p.getAttribute("#authPhone", "dir") === "ltr", "join form: name, email, mobile (tel, LTR), password");
  await p.fill("#authEmail", "new@example.invalid"); await p.fill("#authPhone", "343 999 0002"); await p.fill("#authPassword", "longenough");
  await p.click("#authSubmit"); await p.waitForTimeout(100);
  ok(/add your name/.test(await msg(p)) && await p.evaluate(() => document.activeElement.id) === "authName" && !sent.some((s) => s.u.includes("/signup")), "no name: says so, focuses it, sends nothing");
  await p.fill("#authName", "Huda"); await p.fill("#authPhone", "12345"); await p.click("#authSubmit"); await p.waitForTimeout(100);
  ok(/mobile number/.test(await msg(p)) && !sent.some((s) => s.u.includes("/signup")), "bad mobile: says so, sends nothing");
  await p.fill("#authPhone", "(343) 999-0002"); await p.click("#authSubmit"); await p.waitForTimeout(300);
  const su = sent.find((s) => s.u.includes("/auth/v1/signup"));
  ok(su && su.body.email === "new@example.invalid" && su.body.data && su.body.data.display_name === "Huda" && su.body.data.phone === "+13439990002", "sign-up sends name + mobile (+1 normalised) as user metadata");
  ok(/confirm your account/.test(await msg(p)), "email confirmation stays: 'Check your email to confirm your account'");
  await p.close();
}
{ // F-OWN-8: details shown and edited
  const { p, sent } = await open({ signedIn: true });
  await p.waitForSelector(".auth-dl");
  const dl = await p.textContent(".auth-dl");
  ok(/Amal <b>S<\/b>/.test(dl) && /\+13439990001/.test(dl) && /m@example\.com/.test(dl) && await p.locator(".auth-dl b").count() === 0, "details: name (as text), mobile, email");
  await p.click("#authEditDetails"); await p.waitForSelector("#authDetailsForm");
  ok(await p.inputValue("#pfName") === "Amal <b>S</b>" && await p.inputValue("#pfPhone") === "+13439990001" && await p.evaluate(() => document.activeElement.id) === "pfName", "edit form prefilled, focus on the name");
  await p.fill("#pfPhone", "999"); await p.click("#pfSave"); await p.waitForTimeout(100);
  ok(/mobile number/.test(await msg(p)) && !sent.some((s) => s.u.includes("update_my_profile")), "bad mobile refused before sending");
  await p.fill("#pfName", "Amal Saleh"); await p.fill("#pfPhone", "343.999.0005"); await p.click("#pfSave"); await p.waitForTimeout(400);
  const up = sent.find((s) => s.u.includes("update_my_profile"));
  ok(up && up.body.p_name === "Amal Saleh" && up.body.p_phone === "+13439990005" && !sent.some((s) => s.m === "PUT"), "saves name + mobile through update_my_profile; email untouched, so no email change call");
  ok(/Saved\./.test(await p.textContent(".auth-details")) && /Amal Saleh/.test(await p.textContent(".auth-dl")) && /\+13439990005/.test(await p.textContent(".auth-dl")), "shows Saved. and the new values");
  await p.click("#authEditDetails"); await p.fill("#pfEmail", "amal@example.invalid"); await p.click("#pfSave"); await p.waitForTimeout(400);
  const put = sent.find((s) => s.m === "PUT" && s.u.includes("/auth/v1/user"));
  ok(put && put.body.email === "amal@example.invalid" && /confirmation we sent to amal@example\.invalid/.test(await p.textContent(".auth-details")), "email change goes through Supabase Auth and says to open the confirmation");
  await p.click("#authEditDetails"); await p.click("#authCancelDetails");
  ok(await p.locator("#authDetailsForm").count() === 0 && await p.evaluate(() => document.activeElement.id) === "authEditDetails", "Cancel closes the form and returns focus to Edit");
  await p.close();
}
{ // before 0008 the profile has no phone column: details read-only, no dead Edit button
  const { p } = await open({ signedIn: true, profile: { id: "u1", display_name: "Amal" } });
  await p.waitForSelector(".auth-dl");
  ok(await p.locator("#authEditDetails").count() === 0 && /Not added yet/.test(await p.textContent(".auth-dl")), "server without 0008: no Edit button (nothing dead), mobile shows 'Not added yet'");
  await p.close();
}
{ // Arabic at 320
  const { p } = await open({ signedIn: true, lang: "ar", w: 320 });
  await p.waitForSelector(".auth-dl"); await p.click("#authEditDetails"); await p.waitForSelector("#authDetailsForm");
  ok(/بياناتك/.test(await p.textContent(".auth-details-title")) && await p.getAttribute("#pfPhone", "dir") === "ltr", "Arabic: 'بياناتك', mobile field left-to-right");
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Arabic at 320px: no horizontal scroll with the edit form open");
  await p.close();
}
{ // ChatGPT #60 review: a save still in flight when the member signs out never paints "Saved." on the signed-out page
  let release; const hold = new Promise((r) => (release = r));
  const { p } = await open({ signedIn: true, hold });
  await p.waitForSelector(".auth-dl"); await p.click("#authEditDetails"); await p.fill("#pfName", "Late Name"); await p.click("#pfSave"); await p.waitForTimeout(100);
  await p.click("#authSignOut"); await p.waitForTimeout(300); release(); await p.waitForTimeout(400);
  const t = await p.textContent(".member-card");
  ok(!/Saved\.|Late Name/.test(t) && await p.locator("#authForm").count() === 1, "sign out during a save: the late answer is not shown; the sign-in form stays");
  await p.close();
}
{ // lead B5: name/mobile and email are two outcomes; one failing does not hide the other
  const { p, sent } = await open({ signedIn: true, failEmail: true });
  await p.waitForSelector(".auth-dl"); await p.click("#authEditDetails");
  await p.fill("#pfName", "Amal Saleh"); await p.fill("#pfEmail", "new@example.invalid"); await p.click("#pfSave"); await p.waitForTimeout(500);
  const m = await p.textContent("#pfMessage");
  ok(/Saved\./.test(m) && /email was not changed/.test(m) && await p.locator("#authDetailsForm").count() === 1, "name saved + email refused: both said, the form stays open to retry the email");
  ok(sent.some((x) => x.u.includes("update_my_profile")) && sent.some((x) => x.m === "PUT"), "both calls were made independently");
  await p.close();
}
{ // lead B4: the profile read names its columns
  const { p, sent } = await open({ signedIn: true });
  await p.waitForSelector(".auth-dl");
  const u = sent.find((x) => x.u.includes("/rest/v1/profiles"));
  ok(u && /select=id,display_name,phone,member_number,created_at&/.test(u.u) && !/select=\*/.test(u.u), "profile read names its columns: id,display_name,phone,member_number,created_at (no *)");
  await p.close();
}
{ // lead 14:47: link for existing members only; an unknown email gets the same neutral answer
  const { p, sent } = await open();
  await p.route("https://fake.supabase.co/auth/v1/otp**", (r) => r.fulfill({ status: 422, json: { msg: "Signups not allowed for otp" } }));
  await p.click("#authUseCode"); await p.fill("#authEmail", "nobody@example.invalid"); await p.click("#authSubmit"); await p.waitForTimeout(300);
  ok(/sign-in link to nobody@example\.invalid/.test(await p.textContent(".member-card")), "unknown email: the same 'we emailed a link' answer (no account-existence leak)");
  ok(/already have an account/.test(await p.textContent(".member-card")) && !/creates your Majlis account/.test(await p.textContent(".member-card")), "the link note no longer promises an account");
  await p.close();
}
await b.close(); srv.close(); if (fails) { console.log(fails + " failed"); process.exit(1); } else console.log("all passed");
