// Sufra share card. Run: node tests/sharecard.browser.mjs  (writes the card PNGs next to SHOT for a look)
import { createRequire } from "node:module"; import http from "node:http"; import { readFileSync, existsSync, writeFileSync } from "node:fs"; import { join, extname, dirname } from "node:path";
const require = createRequire(process.env.NODE_PATH ? join(process.env.NODE_PATH, "x") : import.meta.url); const { chromium } = require("playwright");
const root = new URL("..", import.meta.url).pathname; const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2" };
const srv = http.createServer((q, r) => { const p = join(root, decodeURIComponent(q.url.split("?")[0])); if (!existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": T[extname(p)] || "application/octet-stream" }); r.end(readFileSync(p)); }).listen(0);
const toPreview = async (p) => { await p.evaluate(() => document.getElementById("cartOpen").click()); await p.click("#checkoutButton"); await p.click("#placeDemoOrder"); await p.waitForSelector("#shareTray:not([hidden])"); };
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
const b = await chromium.launch(); const base = `http://localhost:${srv.address().port}`; const out = process.env.SHOT ? dirname(process.env.SHOT) : "/tmp";
for (const lang of ["en", "ar"]) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true }); const net = [];
  // Count only what carries data out (fetch/XHR/beacon/socket or any non-GET); lazy menu photos are not "sending".
  p.on("request", (r) => { if (!r.url().startsWith(base) && (r.method() !== "GET" || !["image", "font", "stylesheet"].includes(r.resourceType()))) net.push(r.method() + " " + r.resourceType() + " " + r.url()); });
  await p.addInitScript(([l]) => { localStorage.setItem("azal-language", l); localStorage.setItem("azal-demo-cart-v1", JSON.stringify([[1, 2], [6, 1], [8, 2]])); }, [lang]);
  if (lang === "ar") await p.addInitScript(() => { window.__shared = null; navigator.canShare = () => true; navigator.share = async (d) => { const u = await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(d.files[0]); }); window.__shared = { n: d.files.length, type: d.files[0].type, size: d.files[0].size, name: d.files[0].name, url: u }; }; });
  await p.goto(base + "/menu.html"); await p.evaluate(() => document.getElementById("cartOpen").click());
  ok(await p.locator("#cartDrawer #shareTray, .cart-bottom #shareTray").count() === 0, `${lang}: no share button in the cart drawer any more`);
  await p.click("#checkoutButton");
  ok(await p.locator("#shareTray").isHidden(), `${lang}: hidden before the preview runs`);
  await p.click("#placeDemoOrder"); await p.waitForSelector("#shareTray:not([hidden])");
  ok(await p.locator("#checkoutModal #shareTray").isVisible(), `${lang}: share button appears in the preview result (dead end becomes the payoff)`);
  net.length = 0; // the menu's own photos load from an image CDN; only requests caused by sharing count
  if (lang === "en") {
    const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#shareTray")]);
    const path = join(out, "share-en.png"); await dl.saveAs(path); const buf = readFileSync(path);
    ok(dl.suggestedFilename() === "azal-sufra.png" && buf.slice(1, 4).toString() === "PNG" && buf.readUInt32BE(16) === 1080 && buf.readUInt32BE(20) === 1350, "no share sheet: downloads a 1080x1350 PNG");
  } else {
    await p.click("#shareTray"); await p.waitForFunction(() => window.__shared);
    const s = await p.evaluate(() => window.__shared);
    ok(s.n === 1 && s.type === "image/png" && s.size > 20000 && s.name === "azal-sufra.png", "share sheet receives one PNG file");
    writeFileSync(join(out, "share-ar.png"), Buffer.from(s.url.split(",")[1], "base64"));
  }
  ok(net.length === 0, `${lang}: sharing sends nothing to any other host`);
  await p.close();
}
{ const p = await b.newPage(); await p.goto(base + "/menu.html");
  ok(await p.locator("#shareTray").isHidden(), "empty tray: no share button"); await p.close(); }
{ // the tray is captured before the preview clears the cart; reopening checkout hides the button again
  const p = await b.newPage({ acceptDownloads: true });
  await p.addInitScript(() => { localStorage.setItem("azal-demo-cart-v1", JSON.stringify([[1, 2], [6, 1]])); navigator.canShare = () => false; });
  await p.goto(base + "/menu.html"); await toPreview(p);
  ok(await p.evaluate(() => cart.size) === 0, "preview cleared the cart as before");
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#shareTray")]);
  const buf = readFileSync(await dl.path()); ok(buf.length > 20000, "card still drawn from the captured tray after the cart was cleared");
  await p.click("#modalClose"); await p.evaluate(() => { cart.set(5, 1); renderCart(); document.getElementById("cartOpen").click(); }); await p.click("#checkoutButton");
  ok(await p.locator("#shareTray").isHidden(), "reopening checkout hides the old share button"); await p.close(); }
{ // French + the guest cancelling the share sheet: no fallback download, no message
  const p = await b.newPage({ acceptDownloads: true }); let downloads = 0; p.on("download", () => downloads++);
  await p.addInitScript(() => { localStorage.setItem("azal-language", "fr"); localStorage.setItem("azal-demo-cart-v1", JSON.stringify([[5, 1]])); navigator.canShare = () => true; navigator.share = async () => { throw Object.assign(new Error("cancel"), { name: "AbortError" }); }; });
  await p.goto(base + "/menu.html"); await toPreview(p);
  ok(/Partager ce plateau/.test(await p.textContent("#shareTray")), "French button");
  await p.click("#shareTray"); await p.waitForTimeout(800);
  ok(downloads === 0 && (await p.textContent(".share-status")) === "", "share sheet cancelled: nothing downloaded, no message"); await p.close(); }
{ // share sheet unavailable for files -> download fallback with a confirmation
  const p = await b.newPage({ acceptDownloads: true });
  await p.addInitScript(() => { localStorage.setItem("azal-demo-cart-v1", JSON.stringify([[5, 1]])); navigator.canShare = () => false; });
  await p.goto(base + "/menu.html"); await toPreview(p);
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#shareTray")]);
  ok(dl.suggestedFilename() === "azal-sufra.png" && /Picture made/.test(await p.textContent(".share-status")), "canShare false: PNG download + 'Picture made'"); await p.close(); }
{ // v2: the share sheet also receives the link that reopens this exact tray, and the card prints it
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.addInitScript(() => { localStorage.setItem("azal-demo-cart-v1", JSON.stringify([[1, 2], [6, 1]])); window.__s = null; navigator.canShare = () => true; navigator.share = async (d) => { window.__s = { text: d.text, files: d.files.length }; }; });
  await p.goto(base + "/menu.html"); await toPreview(p); await p.click("#shareTray"); await p.waitForFunction(() => window.__s);
  const sh = await p.evaluate(() => window.__s);
  ok(sh.files === 1 && /^Open our tray: http:\/\/localhost:\d+\/menu\.html#tray=v1\.1x2\.6x1$/.test(sh.text), "v2: share carries the picture AND the tray link (" + sh.text + ")"); await p.close(); }
{ // v2 receiving side: shown first, cart untouched until the tap; retired dish disclosed; fragment cleared
  const p = await b.newPage({ viewport: { width: 390, height: 844 } }); const net = []; p.on("request", (r) => { if (!r.url().startsWith(base)) net.push(r.url()); });
  await p.addInitScript(() => localStorage.setItem("azal-demo-cart-v1", JSON.stringify([[8, 1]])));
  await p.goto(base + "/menu.html#tray=v1.1x2.6x1.999x1"); await p.waitForSelector(".shared-tray");
  const t = await p.textContent(".shared-tray");
  ok(/A tray shared with you/.test(t) && /2× Lamb Mandi/.test(t) && /1× Sahawiq/.test(t) && /1 dish\(es\) from this tray are no longer on the menu/.test(t) && /orders nothing/.test(t), "v2: banner lists the tray, discloses the retired dish, keeps the honesty note");
  ok(JSON.stringify(await p.evaluate(() => [...cart.entries()])) === "[[8,1]]", "v2: opening the link does not touch the guest's cart");
  net.length = 0; await p.click(".shared-tray .button-gold");
  ok(JSON.stringify(await p.evaluate(() => [...cart.entries()].sort((a, b) => a[0] - b[0]))) === "[[1,2],[6,1],[8,1]]" && /Added to your order/.test(await p.textContent(".shared-tray")), "v2: one tap adds the tray to the guest's own cart");
  ok(!(await p.evaluate(() => location.hash)) && net.length === 0, "v2: fragment cleared; nothing sent anywhere"); await p.close(); }
{ // v2: crafted link -> visible 'not valid', cart untouched; 'Not now' leaves the cart alone; Arabic RTL
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto(base + "/menu.html#tray=v1.1x2.<img>"); await p.waitForSelector(".shared-tray");
  ok(/isn’t valid/.test(await p.textContent(".shared-tray")) && await p.evaluate(() => cart.size) === 0 && await p.locator(".shared-tray img").count() === 0, "v2: crafted link is refused visibly, nothing injected, cart untouched");
  await p.close(); }
{ const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.addInitScript(() => localStorage.setItem("azal-language", "ar"));
  await p.goto(base + "/menu.html#tray=v1.5x1"); await p.waitForSelector(".shared-tray");
  ok(/سفرة أُرسلت إليك/.test(await p.textContent(".shared-tray")) && /سلتة/.test(await p.textContent(".shared-tray")), "v2: Arabic banner with the Arabic dish name");
  await p.click(".shared-tray .share-tray");
  ok(await p.locator(".shared-tray").count() === 0 && await p.evaluate(() => cart.size) === 0, "v2: 'Not now' closes it and adds nothing"); await p.close(); }
{ // exactness: a shared 50 lands as 50; adding to a cart that already holds the dish is capped at 50 and SAID so
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.addInitScript(() => localStorage.setItem("azal-demo-cart-v1", JSON.stringify([[1, 10]])));
  await p.goto(base + "/menu.html#tray=v1.1x50.6x21"); await p.waitForSelector(".shared-tray");
  ok(/50× Lamb Mandi/.test(await p.textContent(".shared-tray")) && /21× Sahawiq/.test(await p.textContent(".shared-tray")), "exact: 50 and 21 are shown as sent, not clamped");
  await p.click(".shared-tray .button-gold");
  ok(JSON.stringify(await p.evaluate(() => [...cart.entries()].sort((a, b) => a[0] - b[0]))) === "[[1,50],[6,21]]" && /capped at 50/.test(await p.textContent(".shared-tray")), "10 + 50 is capped at the cart's 50 and the guest is told");
  await p.close(); }
await b.close(); srv.close(); console.log(fails ? `${fails} failed` : "all passed"); process.exit(fails ? 1 : 0);
