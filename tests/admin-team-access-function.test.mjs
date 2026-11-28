import test from "node:test";
import assert from "node:assert/strict";
import { logActionFailure } from "../supabase/functions/admin-team-access/error-log.mjs";

test("T-14 action exception is logged server-side with action and stack while client response stays generic", () => {
  const entries = [];
  const logger = { error: (...args) => entries.push(args) };
  const failure = new TypeError("Auth Admin update rejected");
  logActionFailure("customer_anonymize", failure, logger);
  assert.equal(entries.length, 1);
  assert.equal(entries[0][0], "[admin-team-access] action failed");
  assert.equal(entries[0][1].action, "customer_anonymize");
  assert.equal(entries[0][1].name, "TypeError");
  assert.match(entries[0][1].message, /Auth Admin update rejected/);
  assert.match(entries[0][1].stack, /TypeError/);
});

test("T-14 action diagnostic safely handles non-Error throws", () => {
  const entries = [];
  logActionFailure("customer_anonymize", { code: "network_failure" }, { error: (...args) => entries.push(args) });
  assert.deepEqual(entries[0][1], { action: "customer_anonymize", message: "[object Object]" });
});
