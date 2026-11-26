// Fresh from the oven (Claude): example batch times flagged on pickup slots, clearly labelled as examples.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const js = fs.readFileSync(path.join(root, "script.js"), "utf8");
const C = Function(`return (${js.match(/const PICKUP=(\{[^}]*\});/)[1]});`)();
const plan = Function(`${js.match(/function pickupPlan\(nowMin,c\)\{[\s\S]*?\n\}/)[0]}; return pickupPlan;`)();

test("2-3 example batch times, all on the 15-minute slot grid within opening hours", () => {
  assert.ok(C.freshExample.length >= 2 && C.freshExample.length <= 3);
  for (const m of C.freshExample) { assert.equal(m % C.step, 0); assert.ok(m >= C.open + C.prep && m <= C.last); }
  assert.match(js, /freshExample = EXAMPLE oven-batch times/);
});
test("every example batch time is an offered slot on a normal morning", () => {
  const slots = plan(9 * 60, C).slots;
  for (const m of C.freshExample) assert.ok(slots.includes(m));
});
test("labels: short tag, full words for screen readers, and an 'example times' note", () => {
  assert.match(js, /pickupFreshShort:"Fresh"/); assert.match(js, /pickupFreshShort:"Du four"/);
  assert.match(js, /pickupFreshLong:"fresh from the oven"/);
  assert.match(js, /Example times for this preview; our kitchen will set the real ones\./);
  assert.match(js, /shown\.some\(isFresh\)\?`<p class="fresh-note">/);
});
