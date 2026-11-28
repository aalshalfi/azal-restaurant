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
    "/rest/v1/rpc/azal_admin_customer_directory_page": { rows: [
      { user_id: "u1", display_name: "Amal", phone: "+16135550101", email: "amal@example.invalid", member_number: 10001, created_at: "2026-11-01T00:00:00Z", balance: 100, membership_status: "active", joined_at: "2026-11-01T00:00:00Z" },
      { user_id: "u2", display_name: "Sara", phone: "+16135550102", email: "sara@example.invalid", member_number: 10002, created_at: "2026-11-02T00:00:00Z", balance: 55, membership_status: "suspended", joined_at: "2026-11-02T00:00:00Z" }
    ], total: 2, limit: 50, offset: 0 },
    "/rest/v1/rpc/azal_admin_customer_contact": { user_id: "u1", display_name: "Amal", phone: "+16135550101", member_number: 10001, email: "amal@example.invalid" },
    "/rest/v1/rpc/azal_admin_order_customer_emails": [{user_id:"u1",email:"amal@example.invalid"},{user_id:"u2",email:"sara@example.invalid"}],
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
      { id: "4d9d36ab-1111-4111-8111-111111111111", user_id: "u1", branch_slug: "ottawa", fulfilment_status: "handed_over", payment_status: "paid", total_cents: 2499, placed_at: "2026-11-20T10:00:00Z", contact_phone: null },
      { id: "22222222-2222-4222-8222-222222222222", user_id: "u2", branch_slug: "second", fulfilment_status: "cancelled", payment_status: "refunded", total_cents: 599, placed_at: "2026-11-21T10:00:00Z", contact_phone: null },
      { id: "33333333-3333-4333-8333-333333333333", user_id: null, branch_slug: "ottawa", fulfilment_status: "placed", payment_status: "unpaid", total_cents: 677, placed_at: "2026-11-22T10:00:00Z", guest_name: "Guest Amal", guest_email: "guest@example.invalid", contact_phone: "+16135550103" }
    ]
  };
  const fetch = async (url, init={}) => {
    calls.push({ url, init });
    const path = new URL(url).pathname;
    const key = Object.keys(data).find(k => path === k || path.startsWith(k + "/"));
    let body = data[key] || [];
    if (path === "/rest/v1/rpc/azal_admin_customer_directory_page") {
      const args = JSON.parse(init.body || "{}");
      const all = data[key].rows;
      const term = String(args.p_search || "").toLowerCase();
      const filtered = all.filter(p => !term || [p.display_name,p.phone,p.email,String(p.member_number)].some(v => String(v || "").toLowerCase().includes(term)));
      body = { rows: filtered.slice(args.p_offset || 0, (args.p_offset || 0) + (args.p_limit || 50)), total: filtered.length, limit: args.p_limit || 50, offset: args.p_offset || 0 };
    }
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
  const page = await api.customers();
  const rows = page.rows;
  assert.equal(rows.length, 2);
  assert.equal(page.total, 2);
  assert.deepEqual(rows.map(x => x.user_id).sort(), ["u1","u2"], "staff and admin profiles are not customer-directory entries");
  assert.deepEqual(rows.map(x => [x.display_name, x.email, x.member_number, x.membership.status, x.balance]), [["Amal","amal@example.invalid",10001,"active",100],["Sara","sara@example.invalid",10002,"suspended",55]]);
  assert.ok(calls.some(x => x.url.includes("/rest/v1/rpc/azal_admin_customer_directory_page") && x.init.method === "POST"));
  assert.ok(!calls.some(x => x.url.includes("/rest/v1/points_ledger") || x.url.includes("/rest/v1/memberships")), "directory page must not download the full ledger or memberships");
});

test("customer directory search matches name, phone and membership number", async () => {
  const { api } = fixture();
  assert.deepEqual((await api.customers({ search: "amal" })).rows.map(x => x.user_id), ["u1"]);
  assert.deepEqual((await api.customers({ search: "6135550102" })).rows.map(x => x.user_id), ["u2"]);
  assert.deepEqual((await api.customers({ search: "10001" })).rows.map(x => x.user_id), ["u1"]);
  assert.deepEqual((await api.customers({ search: "sara@example.invalid" })).rows.map(x => x.user_id), ["u2"]);
});

test("order history has no date/status exclusion and preserves handed_over, cancelled and unpaid rows", async () => {
  const { api, calls } = fixture();
  const rows = await api.orders();
  assert.deepEqual(rows.map(x => x.fulfilment_status), ["handed_over","cancelled","placed"]);
  assert.deepEqual(rows.map(x => x.payment_status), ["paid","refunded","unpaid"]);
  const q = calls.find(x => x.url.includes("/rest/v1/orders?select=id,user_id"));
  assert.ok(q);
  assert.ok(!calls.some(x => x.url.includes("/rest/v1/profiles?") || x.url.includes("/rest/v1/rpc/azal_admin_order_customer_emails")), "order list must not fetch customer profiles or emails");
  assert.ok(!calls.some(x => x.url.includes("/rest/v1/rpc/azal_admin_customer_directory")), "order list must not download the whole customer directory");
  assert.ok(!/guest_name|guest_email|contact_phone/.test(new URL(q.url).searchParams.get("select") || ""), "order list SELECT excludes contact fields");
  assert.ok(!q.url.includes("placed_at=gte"));
  assert.ok(!q.url.includes("fulfilment_status=neq"));
  assert.ok(!q.url.includes("payment_status=eq.paid"));
  assert.equal(rows[0].customer, undefined);
  assert.equal(rows[0].customerEmail, undefined);
  assert.equal((await api.orders({ search: "Sara" })).length, 0, "order list does not search customer names");
  assert.equal((await api.orders({ search: "amal@example.invalid" })).length, 0, "order list does not search customer email");
  assert.equal((await api.orders({ search: "4D9D36" })).length, 1, "public six-character order code is searchable");
  assert.equal((await api.orders({ search: "4D9D36" }))[0].id, "4d9d36ab-1111-4111-8111-111111111111");
  assert.equal((await api.orders({ status: "cancelled" })).length, 1);
});

test("public order code is the first six characters, uppercased", () => {
  assert.equal(A.publicCode("4d9d36ab-1111-4111-8111-111111111111"), "4D9D36");
});

test("order detail includes immutable item snapshots, options, events, totals and member contact profile", async () => {
  const { api, calls } = fixture();
  const d = await api.orderDetail("4d9d36ab-1111-4111-8111-111111111111");
  assert.equal(d.customer.display_name, "Amal");
  assert.equal(d.customer.email, "amal@example.invalid");
  assert.equal(d.order_items[0].item_name_en_snapshot, "Lamb Mandi");
  assert.equal(d.order_items[0].order_item_options[0].option_name_en_snapshot, "Extra sauce");
  assert.equal(d.order_events[0].event_type, "hand_over");
  assert.equal(d.customer_note, "No onions");
  assert.ok(calls.some(x => x.url.includes("order_item_options") && x.url.includes("order_events")));
  assert.ok(calls.some(x => x.url.includes("/rpc/azal_admin_customer_contact")), "email is fetched only for the selected order detail");
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

test("0014 exposes only explicit customer fields behind a fixed-path admin-only definer", () => {
  const sql = read("supabase/migrations/0014_admin_customer_directory.sql");
  assert.match(sql, /security definer[\s\S]*set search_path = ''/i);
  assert.match(sql, /auth\.uid\(\) is null or not public\.azal_is_admin\(\)/);
  assert.match(sql, /join auth\.users u on u\.id = p\.id/);
  assert.match(sql, /u\.email::text/);
  assert.match(sql, /p\.anonymized_at is null/);
  assert.match(sql, /r\.role in \('admin', 'staff'\)/);
  assert.doesNotMatch(sql, /raw_user_meta_data|encrypted_password|user_metadata|app_metadata/i);
  assert.match(sql, /revoke all on function public\.azal_admin_customer_directory\(\) from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.azal_admin_customer_directory\(\) to authenticated/i);
});

test("T-23C founder badge is rendered after the member name and before member metadata", () => {
  const auth = read("auth.js");
  const name = auth.indexOf('<div class="mcard-name">');
  const badge = auth.indexOf('id="authFounderMark"');
  const meta = auth.indexOf('<div class="mcard-meta">', name);
  assert.ok(name >= 0 && badge > name && meta > badge);
});


test("A1 1,000-customer page is fetched server-side with a bounded limit and offset", async () => {
  const calls=[];
  const fetch=async(url,init={})=>{
    calls.push({url,init});
    const args=JSON.parse(init.body||"{}");
    return {ok:true,status:200,headers:{get:()=>null},json:async()=>({
      rows:Array.from({length:args.p_limit},(_,i)=>({user_id:"u"+(args.p_offset+i),display_name:"Customer "+(args.p_offset+i),phone:null,email:"x@example.invalid",member_number:10000+args.p_offset+i,balance:0,membership_status:"active"})),
      total:1000,limit:args.p_limit,offset:args.p_offset
    })};
  };
  const api=A.createAdmin({config:{url:"https://fake.supabase.co",anonKey:"anon"},fetch,getSession:async()=>({access_token:"token",user:{id:"admin"}})});
  const page=await api.customers({search:"Customer",limit:50,offset:950});
  assert.equal(page.rows.length,50);
  assert.equal(page.total,1000);
  assert.equal(page.offset,950);
  assert.ok(calls[0].url.endsWith("/rest/v1/rpc/azal_admin_customer_directory_page"));
  assert.deepEqual(JSON.parse(calls[0].init.body),{p_search:"Customer",p_limit:50,p_offset:950});
  assert.ok(!calls.some(x=>x.url.includes("/rest/v1/points_ledger")||x.url.includes("/rest/v1/memberships")));
});
