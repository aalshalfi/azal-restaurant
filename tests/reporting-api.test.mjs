import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createAdmin } = require("../admin.js");
const { createStaff } = require("../staff.js");

function response(data) {
  return { ok: true, headers: { get: () => null }, json: async () => data };
}

test("T-25 salesReport calls the scoped RPC with validated Toronto period inputs", async () => {
  const calls = [];
  const api = createAdmin({
    config: { url: "https://example.invalid", anonKey: "public" },
    getSession: async () => ({ access_token: "session-token" }),
    fetch: async (url, options) => { calls.push({ url, options }); return response({ role: "manager", rows: [], totals: {} }); }
  });
  const result = await api.salesReport({ period: "month", startDate: "2026-11-01", endDate: "2026-11-30", branchSlug: "ottawa" });
  assert.equal(result.role, "manager");
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/rpc\/azal_sales_report$/);
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    p_period: "month", p_start_date: "2026-11-01", p_end_date: "2026-11-30", p_branch_slug: "ottawa"
  });
  assert.equal(calls[0].options.method, "POST");
});

test("T-25 rejects invalid periods before making a request", async () => {
  let calls = 0;
  const api = createAdmin({
    config: { url: "https://example.invalid", anonKey: "public" },
    getSession: async () => ({ access_token: "session-token" }),
    fetch: async () => { calls++; return response({}); }
  });
  await assert.rejects(api.salesReport({ period: "week", startDate: "2026-11-01", endDate: "2026-11-30" }),
    (error) => error.code === "invalid_report_period");
  await assert.rejects(api.salesReport({ period: "day", startDate: "2026-11-30", endDate: "2026-11-01" }),
    (error) => error.code === "invalid_report_period");
  assert.equal(calls, 0);
});

test("T-25 requires a signed-in session", async () => {
  const api = createAdmin({
    config: { url: "https://example.invalid", anonKey: "public" },
    getSession: async () => null,
    fetch: async () => response({})
  });
  await assert.rejects(api.salesReport({ period: "day", startDate: "2026-11-28", endDate: "2026-11-28" }),
    (error) => error.code === "signed_out");
});

test("T-26 requests the staff summary for the selected authorized branch", async () => {
  const calls = [];
  const api = createStaff({
    config: { url: "https://example.invalid", anonKey: "public" },
    getToken: async () => "staff-token",
    branch: "ottawa",
    fetch: async (url, options) => { calls.push({ url, options }); return response({ branch_slug: "ottawa", net_collected_cents: 1999 }); }
  });
  const result = await api.todaySummary();
  assert.equal(result.branch_slug, "ottawa");
  assert.equal(result.net_collected_cents, 1999);
  assert.equal(Object.hasOwn(result, "collected_cents"), false);
  assert.equal(Object.hasOwn(result, "refunds_cents"), false);
  assert.match(calls[0].url, /\/rpc\/azal_staff_today_summary$/);
  assert.deepEqual(JSON.parse(calls[0].options.body), { p_branch_slug: "ottawa" });
});
