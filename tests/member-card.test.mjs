// T-23 step 3: the membership barcode is standard Code 39 for the number. Expected patterns come from an INDEPENDENT
// encoder (ReportLab Standard39, checksum off): b/s narrow bar/space, B/S wide, i = inter-character gap.
import test from "node:test"; import assert from "node:assert/strict"; import { createRequire } from "node:module";
const require = createRequire(import.meta.url); const A = require("../auth.js");
const flat = (els) => els.map((x, i) => (i % 10 === 9 ? "i" : x.bar ? (x.wide ? "B" : "b") : x.wide ? "S" : "s")).join("");
test("Code 39 matches ReportLab for member numbers", () => {
  assert.equal(flat(A.code39("10001")), "bSbsBsBsbiBsbSbsbsBibsbSBsBsbibsbSBsBsbibsbSBsBsbiBsbSbsbsBibSbsBsBsb");
  assert.equal(flat(A.code39("98765")), "bSbsBsBsbibsBSbsBsbiBsbSbsBsbibsbSbsBsBibsBSBsbsbiBsbSBsbsbibSbsBsBsb");
});
test("only digits are encoded; anything else gives no barcode", () => {
  assert.equal(A.code39("10a01"), null); assert.equal(A.code39(""), null); assert.equal(A.code39Svg("<x>", "l"), "");
  assert.match(A.code39Svg(10001, 'Membership barcode 10001"'), /aria-label="Membership barcode 10001"/);
});
test("V-2 wire: pulse.js announces a collected order exactly on the change to handed_over", async () => {
  const { readFileSync } = await import("node:fs");
  const s = readFileSync(new URL("../pulse.js", import.meta.url), "utf8");
  assert.match(s, /if \(lastStatus !== null\) \{[^}]*if \(key === "handed_over"\) \{ try \{ document\.dispatchEvent\(new CustomEvent\("azal:order-collected"\)\)/);
  const a = readFileSync(new URL("../auth.js", import.meta.url), "utf8");
  assert.match(a, /addEventListener\("azal:order-collected", \(\) => quietRefresh\(true\)\)/);
});
