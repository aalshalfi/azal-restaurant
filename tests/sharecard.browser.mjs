// Sufra share card. Run: node tests/sharecard.browser.mjs  (writes the card PNGs next to SHOT for a look)
import { createRequire } from "node:module"; import http from "node:http"; import { readFileSync, existsSync, writeFileSync } from "node:fs"; import { join, extname, dirname } from "node:path";
const require = createRequire(process.env.NODE_PATH ? join(process.env.NODE_PATH, "x") : import.meta.url); const { chromium } = require("playwright");
const root = new URL("..", import.meta.url).pathname; const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2" };
const srv = http.createServer((q, r) => { const p = join(root, decodeURIComponent(q.url.split("?")[0])); if (!existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": T[extname(p)] || "application/octet-stream" }); r.end(readFileSync(p)); }).listen(0);
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
const b = await chromium.launch(); const base = `http://localhost:${srv.address().port}`; const out = process.env.SHOT ? dirname(process.env.SHOT) : "/tmp";
for (const lang of ["en", "ar"]) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true }); const net = [];
  // "Sends" = anything that carries data out: fetch/XHR/beacon/websocket/form, or any non-GET. The menu's own lazy dish
  // photos (GET images from the photo CDN) can still be loading while the test runs, so they do not count (CI has open
  // network; the sandbox does not, which hid this). Failures print the offending requests.
  p.on("request", (r) => { if (!r.url().startsWith(base) && (r.method() !== "GET" || !["image", "font", "stylesheet"].includes(r.resourceType()))) net.push(r.method() + " " + r.resourceType() + " " + r.url()); });
  await p.addInitScript(([l]) => { localStorage.setItem("azal-language", l); localStorage.setItem("azal-demo-cart-v1", JSON.stringify([[1, 2], [6, 1], [8, 2]])); }, [lang]);
  if (lang === "ar") await p.addInitScript(() => { window.__shared = null; navigator.canShare = () => true; navigator.share = async (d) => { const u = await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(d.files[0]); }); window.__shared = { n: d.files.length, type: d.files[0].type, size: d.files[0].size, name: d.files[0].name, url: u }; }; });
  await p.goto(base + "/menu.html"); await p.evaluate(() => document.getElementById("cartOpen").click());
  ok(await p.locator("#shareTray").isVisible(), `${lang}: share button shows when the tray has dishes`);
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
  ok(net.length === 0, `${lang}: sharing sends nothing to any other host` + (net.length ? " " + JSON.stringify(net) : ""));
  await p.close();
}
{ const p = await b.newPage(); await p.goto(base + "/menu.html"); await p.evaluate(() => document.getElementById("cartOpen").click());
  ok(await p.locator("#shareTray").isHidden(), "empty tray: no share button"); await p.close(); }
{ // French + the guest cancelling the share sheet: no fallback download, no message
  const p = await b.newPage({ acceptDownloads: true }); let downloads = 0; p.on("download", () => downloads++);
  await p.addInitScript(() => { localStorage.setItem("azal-language", "fr"); localStorage.setItem("azal-demo-cart-v1", JSON.stringify([[5, 1]])); navigator.canShare = () => true; navigator.share = async () => { throw Object.assign(new Error("cancel"), { name: "AbortError" }); }; });
  await p.goto(base + "/menu.html"); await p.evaluate(() => document.getElementById("cartOpen").click());
  ok(/Partager ce plateau/.test(await p.textContent("#shareTray")), "French button");
  await p.click("#shareTray"); await p.waitForTimeout(800);
  ok(downloads === 0 && (await p.textContent(".share-status")) === "", "share sheet cancelled: nothing downloaded, no message"); await p.close(); }
{ // share sheet unavailable for files -> download fallback with a confirmation
  const p = await b.newPage({ acceptDownloads: true });
  await p.addInitScript(() => { localStorage.setItem("azal-demo-cart-v1", JSON.stringify([[5, 1]])); navigator.canShare = () => false; });
  await p.goto(base + "/menu.html"); await p.evaluate(() => document.getElementById("cartOpen").click());
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#shareTray")]);
  ok(dl.suggestedFilename() === "azal-sufra.png" && /Picture made/.test(await p.textContent(".share-status")), "canShare false: PNG download + 'Picture made'"); await p.close(); }
await b.close(); srv.close(); console.log(fails ? `${fails} failed` : "all passed"); process.exit(fails ? 1 : 0);
