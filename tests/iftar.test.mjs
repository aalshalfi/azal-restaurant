import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const I = require("../iftar.js");
const toronto = (ms) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(ms));
const mins = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

test("Ottawa sunset within 3 minutes of published values (EST and EDT)", () => {
  for (const [y, m, d, want] of [[2026, 12, 21, "16:22"], [2027, 2, 20, "17:33"], [2027, 6, 21, "20:51"], [2027, 9, 22, "19:04"]]) {
    const got = toronto(I.sunsetMs(y, m, d));
    assert.ok(Math.abs(mins(got) - mins(want)) <= 3, `${y}-${m}-${d}: got ${got}, want ~${want}`);
  }
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
  const r = I.state(Date.parse("2027-02-20T19:00:00Z"), false); // 14:00 Toronto, sunset ~17:33
  assert.ok(r.active && !r.preview && r.ramadanDay > 0 && r.minutesLeft > 200 && r.minutesLeft < 220);
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
