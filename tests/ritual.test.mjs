// Serving-ritual preview (Claude): rules from docs/serving-ritual.md, draft-labelled, inert.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const js = fs.readFileSync(path.join(root, "script.js"), "utf8");
const keys = Function(`${js.match(/function ritualKeys\(ids\)\{[\s\S]*?\n\}/)[0]}; return ritualKeys;`)();

test("doc example: Sufra for 4 -> stew, platter, chai (bread skipped)", () => {
  assert.deepEqual(keys([1, 2, 5, 6, 7, 8]), ["ritualStew", "ritualPlatter", "ritualChai"]);
});
test("platter + bread + chai -> platter, bread, chai", () => {
  assert.deepEqual(keys([1, 6, 8]), ["ritualPlatter", "ritualBread", "ritualChai"]);
});
test("no drink -> closing line; juice without chai -> juice line", () => {
  assert.deepEqual(keys([3]), ["ritualPlatter", "ritualClose"]);
  assert.deepEqual(keys([4, 9]), ["ritualStew", "ritualJuice"]);
});
test("a single small item gets no guide (rule 5)", () => {
  assert.deepEqual(keys([7]), []);
  assert.deepEqual(keys([8]), []);
  assert.deepEqual(keys([7, 9]), []);
});
test("never more than 3 lines", () => {
  for (const ids of [[1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 6, 9], [5, 6, 8]]) assert.ok(keys(ids).length <= 3);
});
test("shown as a draft, cleared with the preview message, no network/storage", () => {
  assert.match(js, /ritualDraft:"Draft serving guide, to be confirmed by our kitchen\."/);
  assert.equal((js.match(/checkoutMessage\.textContent="";if\(typeof clearRitual==="function"\)clearRitual\(\);/g) || []).length, 2);
  const block = js.slice(js.indexOf('/* "Eat it the Yemeni way"'));
  assert.ok(!/fetch\(|localStorage|sessionStorage|supabase/i.test(block));
});
