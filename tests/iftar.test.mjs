import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const I = require("../iftar.js");
const toronto = (ms) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(ms));
const mins = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

test("sunset within 2 minutes of published Ottawa tables; shown iftar time is never before published sunset", () => {
  // Published: sunrisesunset.io Ottawa 2027 and alpenglowapp.com Ottawa 2025 (fetched 2026-11-26).
  for (const [y, m, d, want] of [[2027, 2, 8, "17:21"], [2027, 2, 20, "17:38"], [2027, 3, 9, "18:02"], [2027, 6, 21, "20:57"], [2027, 9, 22, "19:02"], [2027, 12, 21, "16:24"], [2025, 2, 8, "17:20"], [2025, 2, 20, "17:38"]]) {
    const ss = toronto(I.sunsetMs(y, m, d)), ift = toronto(I.iftarMs(y, m, d));
    assert.ok(Math.abs(mins(ss) - mins(want)) <= 2, `${y}-${m}-${d}: sunset ${ss}, published ${want}`);
    assert.ok(mins(ift) >= mins(want), `${y}-${m}-${d}: iftar ${ift} must not be before published sunset ${want}`);
  }
  assert.equal(I.MARGIN_MIN, 2);
});

test("Ramadan comes from the Umm al-Qura calendar, not hard-coded dates", () => {
  assert.equal(I.ramadanDay(Date.parse("2026-11-26T17:00:00Z")), 0);
  assert.equal(I.ramadanDay(Date.parse("2027-02-08T17:00:00Z")), 1);
  assert.ok(I.ramadanDay(Date.parse("2027-03-08T17:00:00Z")) >= 28);
  assert.equal(I.ramadanDay(Date.parse("2027-03-10T17:00:00Z")), 0);
  assert.doesNotMatch(readFileSync(new URL("../iftar.js", import.meta.url), "utf8"), /2027-0[23]/);
});

test("iftar slot = latest pickup at or before sunset; else the first after", () => {
  assert.equal(I.iftarSlot([1020, 1035, 1050, 1065], 1053), 1050);
  assert.equal(I.iftarSlot([1080, 1095], 1053), 1080);
  assert.equal(I.iftarSlot([], 1053), null);
});

test("inactive outside Ramadan unless previewed; countdown during Ramadan", () => {
  assert.equal(I.state(Date.parse("2026-11-26T17:00:00Z"), false).active, false);
  const p = I.state(Date.parse("2026-11-26T17:00:00Z"), true);
  assert.ok(p.active && p.preview && p.before && p.minutesLeft > 0);
  const r = I.state(Date.parse("2027-02-20T19:00:00Z"), false); // 14:00 Toronto, iftar ~17:40
  assert.ok(r.active && !r.preview && r.ramadanDay > 0 && r.minutesLeft > 210 && r.minutesLeft < 225);
  const after = I.state(Date.parse("2027-02-21T00:00:00Z"), false); // 19:00 Toronto
  assert.ok(after.active && !after.before && after.nextSunset > after.sunset);
});

test("every page loads iftar.js after script.js with the release version", () => {
  for (const p of ["index", "menu", "member", "reserve", "story", "404"]) {
    const h = readFileSync(new URL(`../${p}.html`, import.meta.url), "utf8");
    const v = h.match(/script\.js\?v=([\w-]+)"/)[1];
    assert.ok(h.indexOf(`script.js?v=${v}`) < h.indexOf(`iftar.js?v=${v}`), p);
  }
});
