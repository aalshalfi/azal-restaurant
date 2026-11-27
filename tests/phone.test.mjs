import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

test("owner phone (+1 343-999-6199, Muse 06:03) is a tap-to-call link on Visit and Reserve", () => {
  for (const f of ["index.html", "reserve.html"]) {
    const h = read(f);
    assert.match(h, /<a class="phone-link" dir="ltr" href="tel:\+13439996199">(<strong>)?\+1 \(343\) 999-6199/, f);
  }
});

test("visit copy no longer says the phone is coming; no street address invented", () => {
  const s = read("script.js");
  assert.doesNotMatch(s, /address and phone number will be posted/);
  assert.match(s, /open in Orléans\. The street address will be posted here once confirmed\./);
  assert.match(s, /reservePhone:"Des questions, ou un groupe de plus de dix \? Appelez‑nous :"/);
});

test("sync with #32: the table-only reservation page keeps no food-order path, and the phone sits beside the menu link", () => {
  const h = read("reserve.html");
  for (const id of ['id="cartOpen"', 'id="cartDrawer"', 'id="checkoutModal"', 'id="placeDemoOrder"']) assert.ok(!h.includes(id), id);
  assert.match(h, /<p class="reserve-phone">.*tel:\+13439996199.*<\/p><div class="reserve-actions"><a class="button button-gold" href="menu\.html"/);
});
