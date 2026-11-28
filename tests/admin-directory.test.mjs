// T-08 directory and all-status order-history data path. Run: node --test tests/admin-directory.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const A = require("../admin.js");
const read = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");

function fixture() {
  const calls = [];
  const data = {
    "/rest/v1/rpc/azal_admin_customer_directory": [
      { user_id: "u1", display_name: "Amal", phone: "+16135550101", email: "amal@example.invalid", member_number: 10001, created_at: "2026-11-01T00:00:00Z" },
      { user_id: "u2", display_name: "Sara", phone: "+16135550102", email: "sara@example.invalid", member_number: 10002, created_at: "2026-11-02T00:00:00Z" }
    ],
    "/rest/v1/profiles": [
      { id: "u1", display_name: "Amal", phone: "+16135550101", member_number: 10001, created_at: "2026-11-01T00:00:00Z" },
      { id: "u2", display_name: "Sara", phone: "+16135550102", member_number: 10002, created_at: "2026-11-02T00:00:00Z" },
      { id: "staff", display_name: "Kitchen Staff", phone: "+16135550103", member_number: 10003, created_at: "2026-11-03T00:00:00Z" },
      { id: "admin", display_name: "Site Admin", phone: "+16135550104", member_number: 10004, created_at: "2026-11-04T00:00:00Z" }
    ],
    "/rest/v1/memberships": [
      { user_id: "u1", status: "active", joined_at: "2026-11-01T00:00:00Z" },
      { user_id: "u2", status: "suspended", joined_at: "2026-11-02T00:00:00Z" }
    ],
    "/rest/v1/user_roles": [{ user_id: "staff", role: "staff" }, { user_id: "admin", role: "admin" }],
    "/rest/v1/points_ledger": [
      { user_id: "u1", delta_points: 120 }, { user_id: "u1", delta_points: -20 }, { user_id: "u2", delta_points: 55 }
    ],
    "/rest/v1/orders": [
      { id: "11111111-1111-4111-8111-111111111111", user_id: "u1", branch_slug: "ottawa", fulfilment_status: "handed_over", payment_status: "paid", total_cents: 2499, placed_at: "2026-11-20T10:00:00Z", contact_phone: null },
      { id: "22222222-2222-4222-8222-222222222222", user_id: "u2", branch_slug: "second", fulfilment_status: "cancelled", payment_status: "refunded", total_cents: 599, placed_at: "2026-11-21T10:00:00Z", contact_phone: null },
      { id: "33333333-3333-4333-8333-333333333333", user_id: null, branch_slug: "ottawa", fulfilment_status: "placed", payment_status: "unpaid", total_cents: 677, placed_at: "2026-11-22T10:00:00Z", guest_name: "Guest Amal", guest_email: "guest@example.invalid", contact_phone: "+16135550103" }
    ]
  };
  const fetch = async (url, init={}) => {
    calls.push({ url, init });
    const path = new URL(url).pathname;
    const key = Object.keys(data).find(k => path === k || path.startsWith(k + "/"));
    let body = data[key] || [];
    if (path === "/rest/v1/orders" && url.includes("order_items(")) body = [{
      ...data["/rest/v1/orders"][0], subtotal_cents: 2499, discount_cents: 0, redeemed_points: 0, tax_rate_bps: 1300, tax_cents: 325,
      customer_note: "No onions",
      order_items: [{ id: "i1", quantity: 1, item_name_en_snapshot: "Lamb Mandi", item_name_fr_snapshot: "Mandi", unit_price_cents: 2499, line_total_cents: 2499,
        order_item_options: [{ option_name_en_snapshot: "Extra sauce", option_name_fr_snapshot: "Sauce", quantity: 1, line_delta_cents: 100 }] }],
      order_events: [{ id: 1, event_type: "hand_over", from_status: "ready", to_status: "handed_over", details: { source: "staff" }, created_at: "2026-11-20T11:00:00Z" }]
    }];
    if (path === "/rest/v1/profiles" && url.includes("id=eq.u1")) body = [data["/rest/v1/profiles"][0]];
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => body };
  };
  const api = A.createAdmin({ config: { url: "https://fake.supabase.co", anonKey: "anon" }, fetch, getSession: async () => ({ access_token: "token", user: { id: "admin" } }) });
  return { api, calls };
}

test("customer directory joins membership state and derives the exact ledger balance", async () => {
  const { api, calls } = fixture();
  const rows = await api.customers();
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(x => x.user_id).sort(), ["u1","u2"], "staff and admin profiles are not customer-directory entries");
  assert.deepEqual(rows.map(x => [x.display_name, x.email, x.member_number, x.membership.status, x.balance]), [["Amal","amal@example.invalid",10001,"active",100],["Sara","sara@example.invalid",10002,"suspended",55]]);
  assert.ok(calls.some(x => x.url.includes("/rest/v1/rpc/azal_admin_customer_directory") && x.init.method === "POST"));
  assert.ok(calls.some(x => x.url.includes("/rest/v1/points_ledger?select=user_id,delta_points") && x.url.includes("order=created_at.asc,id.asc")));
});

test("customer directory search matches name, phone and membership number", async () => {
  const { api } = fixture();
  assert.deepEqual((await api.customers({ search: "amal" })).map(x => x.user_id), ["u1"]);
  assert.deepEqual((await api.customers({ search: "6135550102" })).map(x => x.user_id), ["u2"]);
  assert.deepEqual((await api.customers({ search: "10001" })).map(x => x.user_id), ["u1"]);
  assert.deepEqual((await api.customers({ search: "sara@example.invalid" })).map(x => x.user_id), ["u2"]);
});

test("order history has no date/status exclusion and preserves handed_over, cancelled and unpaid rows", async () => {
  const { api, calls } = fixture();
  const rows = await api.orders();
  assert.deepEqual(rows.map(x => x.fulfilment_status), ["handed_over","cancelled","placed"]);
  assert.deepEqual(rows.map(x => x.payment_status), ["paid","refunded","unpaid"]);
  const q = calls.find(x => x.url.includes("/rest/v1/orders?select=id,user_id"));
  assert.ok(q);
  assert.ok(calls.some(x => x.url.includes("/rest/v1/profiles?select=id,display_name,phone,member_number") && x.url.includes("order=created_at.desc,id.desc")));
  assert.ok(!q.url.includes("placed_at=gte"));
  assert.ok(!q.url.includes("fulfilment_status=neq"));
  assert.ok(!q.url.includes("payment_status=eq.paid"));
  assert.equal(rows[0].customer.display_name, "Amal");
  assert.equal(rows[0].customerEmail, "amal@example.invalid");
  assert.equal((await api.orders({ search: "Sara" })).length, 1);
  assert.equal((await api.orders({ search: "amal@example.invalid" })).length, 1);
  assert.equal((await api.orders({ status: "cancelled" })).length, 1);
});

test("order detail includes immutable item snapshots, options, events, totals and member contact profile", async () => {
  const { api, calls } = fixture();
  const d = await api.orderDetail("11111111-1111-4111-8111-111111111111");
  assert.equal(d.customer.display_name, "Amal");
  assert.equal(d.customer.email, "amal@example.invalid");
  assert.equal(d.order_items[0].item_name_en_snapshot, "Lamb Mandi");
  assert.equal(d.order_items[0].order_item_options[0].option_name_en_snapshot, "Extra sauce");
  assert.equal(d.order_events[0].event_type, "hand_over");
  assert.equal(d.customer_note, "No onions");
  assert.ok(calls.some(x => x.url.includes("order_item_options") && x.url.includes("order_events")));
});

test("T-08 browser source stays read-only, admin-only in UI, EN/FR/AR, and no destructive history controls", () => {
  const js=read("admin.js"), html=read("admin.html"), css=read("styles.css");
  for (const term of ["directory","ordersTitle","azal_admin_customer_directory"]) assert.match(js,new RegExp(term));
  assert.match(js,/if \(acc\.role !== "admin"\)/);
  assert.match(js,/handed_over/); assert.match(js,/cancelled/);
  assert.doesNotMatch(js,/method: "(PATCH|DELETE|PUT)"/);
  assert.doesNotMatch(js,/innerHTML/);
  assert.match(js,/requestSeq!==seq/);
  assert.match(js,/directoryRows = \[\]; orderRows = \[\]; detailRow = null/);
  assert.match(html,/<meta name="robots" content="noindex, nofollow">/);
  assert.match(css,/T-08 admin directory \+ complete order history/);
});

test("SQL behaviour runner fails on psql errors and explicit FAIL output", () => {
  const runner = read("tests/sql/run-one.sh");
  assert.match(runner, /set -Eeuo pipefail/);
  assert.match(runner, /psql .* -X -v ON_ERROR_STOP=1/);
  assert.match(runner, /ERROR:|FAIL/);
  assert.match(runner, /DATABASE_URL/);
});

test("T-08 SQL suite pins retained terminal history, snapshots and events", () => {
  const sql = read("tests/sql/admin-directory-behaviour.sql");
  assert.match(sql, /\\ir admin-scope-behaviour\.sql/);
  assert.match(sql, /cancelled,handed_over/);
  assert.match(sql, /order_items/);
  assert.match(sql, /order_events/);
  assert.match(sql, /not deleted/);
});
