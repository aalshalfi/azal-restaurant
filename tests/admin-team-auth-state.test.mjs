import test from "node:test";
import assert from "node:assert/strict";
import { anonymizeAuthPatch, captureAuthState, restoreAuthPatch } from "../supabase/functions/admin-team-access/auth-state.mjs";

test("A2 rollback restores an unverified user's email and metadata without confirming it", () => {
  const prior = captureAuthState({
    email: "unverified@example.invalid",
    email_confirmed_at: null,
    user_metadata: { full_name: "Private Name", nested: { phone: "+16135550123" } },
    banned_until: null
  }, 1000);
  assert.deepEqual(restoreAuthPatch(prior), {
    email: "unverified@example.invalid",
    email_confirm: false,
    user_metadata: { full_name: "Private Name", nested: { phone: "+16135550123" } },
    ban_duration: "none"
  });
});

test("A2 rollback preserves a pre-existing ban and does not shorten it to an unban", () => {
  const prior = captureAuthState({
    email: "banned@example.invalid",
    email_confirmed_at: "2026-01-01T00:00:00.000Z",
    user_metadata: { role_hint: "customer" },
    banned_until: "2026-01-01T01:00:01.000Z"
  }, Date.parse("2026-01-01T00:00:00.000Z"));
  assert.equal(prior.ban_duration, "3601s");
  assert.deepEqual(restoreAuthPatch(prior), {
    email: "banned@example.invalid",
    email_confirm: true,
    user_metadata: { role_hint: "customer" },
    ban_duration: "3601s"
  });
});

test("A2 anonymization patch is deterministic and contains no prior metadata", () => {
  assert.deepEqual(anonymizeAuthPatch("00000000-0000-0000-0000-0000000000c2"), {
    email: "removed+000000000000000000000000000000c2@example.invalid",
    email_confirm: true,
    user_metadata: {},
    ban_duration: "876000h"
  });
});
