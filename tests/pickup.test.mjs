// P3 pickup-time step, inert preview (Claude). PK cases from docs/p3-pickup-ui.md that apply to a static preview.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const js = fs.readFileSync(path.join(root, "script.js"), "utf8");
const cfgSrc = js.match(/const PICKUP=(\{[^}]*\});/)[1];
const C = Function(`return (${cfgSrc});`)();
const plan = Function(`${js.match(/function pickupPlan\(nowMin,c\)\{[\s\S]*?\n\}/)[0]}; return pickupPlan;`)();
const hm = (h, m) => h * 60 + m;

test("config matches the design doc defaults", () => {
  assert.deepEqual([C.open, C.close, C.prep, C.step, C.last, C.tz], [660, 1260, 20, 15, 1245, "America/Toronto"]);
});
test("PK1 ASAP = now + prep, rounded up to 5 min", () => {
  assert.equal(plan(hm(12, 13), C).asap, hm(12, 35));
  assert.equal(plan(hm(12, 15), C).asap, hm(12, 35));
  assert.equal(plan(hm(12, 16), C).asap, hm(12, 40));
});
test("PK2 ASAP never before the first pickup; before opening only slots from 11:30", () => {
  assert.equal(plan(hm(11, 0), C).asap, hm(11, 20));
  const p = plan(hm(9, 0), C);
  assert.equal(p.status, "before_open"); assert.equal(p.asap, null); assert.equal(p.slots[0], hm(11, 30));
});
test("PK3 after last orders only tomorrow is offered", () => {
  const p = plan(hm(20, 30), C);
  assert.equal(p.status, "closed_today"); assert.equal(p.day, "tomorrow"); assert.equal(p.asap, null);
  assert.equal(plan(hm(20, 25), C).status, "open"); // 20:25 + 20 = 20:45 = last pickup
});
test("later slots are 15-minute steps after ASAP and never past 20:45", () => {
  const p = plan(hm(12, 13), C);
  assert.equal(p.slots[0], hm(12, 45));
  for (let i = 1; i < p.slots.length; i++) assert.equal(p.slots[i] - p.slots[i - 1], 15);
  assert.equal(p.slots.at(-1), hm(20, 45));
});
test("PK10 inert: no network, no storage of the chosen time", () => {
  const block = js.slice(js.indexOf("/* P3 pickup-time step"));
  assert.ok(!/fetch\(|XMLHttpRequest|supabase|localStorage|sessionStorage/i.test(block));
});
test("markup: fieldset with legend on all pages; demo notice still says nothing is sent", () => {
  for (const p of ["index.html", "menu.html", "story.html", "member.html"]) {
    const h = fs.readFileSync(path.join(root, p), "utf8");
    assert.match(h, /<fieldset class="pickup" id="pickup"><legend data-i18n="pickupTitle">/);
    assert.match(h, /data-i18n="demoPickupOnly">Nothing you choose here is sent, stored or charged\./);
  }
});
