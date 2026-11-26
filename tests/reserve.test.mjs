// R1 reservations page (Claude): inert, shared i18n, no personal-data inputs, no uncleared facts.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const page = fs.readFileSync(path.join(root, "reserve.html"), "utf8");
const main = page.slice(page.indexOf("<main"), page.indexOf("</main>"));
const cfg = fs.readFileSync(path.join(root, "reservation-config.js"), "utf8");

test("no inputs, forms or selects in the page body", () => {
  assert.ok(!/<(form|input|select|textarea)\b/.test(main));
});
test("uses the shared translation system only", () => {
  assert.ok(!/data-res-(en|fr)/.test(page));
  assert.match(page, /<script src="reservation-config\.js"><\/script><script src="script\.js/);
});
test("does not show facts the owner has not cleared (seats, days, hours)", () => {
  assert.ok(!/\b50\b|seats|places|daily|tous les jours|11:00|21:00/i.test(main));
});
test("booking stays disabled in config", () => {
  assert.match(cfg, /bookingEnabled: false/);
  assert.match(cfg, /goLiveAuthorized: false/);
  assert.match(cfg, /notificationEmail: null/);
});
test("Reserve link in the nav of every page; current page marked", () => {
  for (const p of ["index.html", "menu.html", "story.html", "member.html", "reserve.html"]) {
    const h = fs.readFileSync(path.join(root, p), "utf8");
    assert.match(h, /<a href="reserve\.html" data-i18n="navReserve"/, p);
  }
  assert.match(page, /data-i18n="navReserve" aria-current="page"/);
});
