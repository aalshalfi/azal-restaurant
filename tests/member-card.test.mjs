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
