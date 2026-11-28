import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const R=require("../reports.js");
const read=(p)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("reports access resolves Admin and Manager from server-side identity and assigned branches",async()=>{
  const calls=[];
  const api=R.createReports({config:{url:"https://example.supabase.co",anonKey:"anon"},getSession:async()=>({access_token:"T",user:{id:"m1"}}),fetch:async(url,opts)=>{calls.push([url,opts]);let value=url.includes("azal_is_admin")?false:url.includes("user_roles")?[{role:"manager"}]:[{branch_slug:"ottawa"}];return{ok:true,json:async()=>value};}});
  const a=await api.access();
  assert.deepEqual({role:a.role,branches:a.branches},{role:"manager",branches:["ottawa"]});
  assert.equal(calls.length,3);
  assert.ok(calls.every(([,o])=>o.headers.Authorization==="Bearer T"));
});

test("report request sends an exclusive end date and never fetches raw orders",async()=>{
  let request;
  const api=R.createReports({config:{url:"https://example.supabase.co",anonKey:"anon"},getSession:async()=>({access_token:"T",user:{id:"a"}}),fetch:async(url,opts)=>{request={url,opts};return{ok:true,json:async()=>({rows:[]})};}});
  await api.report("T",{bucket:"month",from:"2026-11-01",to:"2026-11-30",branch:"ottawa"});
  assert.equal(request.url,"https://example.supabase.co/rest/v1/rpc/azal_admin_sales_report");
  assert.deepEqual(JSON.parse(request.opts.body),{p_bucket:"month",p_from:"2026-11-01",p_to:"2026-12-01",p_branch_slug:"ottawa"});
  assert.equal(request.opts.method,"POST");
});

test("T-25 migration uses payment-event time, Toronto buckets and server-enforced role/branch gates",()=>{
  const sql=read("supabase/migrations/0017_t25_t26_sales_reports.sql");
  assert.match(sql,/payment_events[\s\S]*received_at/);
  assert.match(sql,/America\/Toronto/);
  assert.match(sql,/azal_is_admin\(\)/);
  assert.match(sql,/azal_is_manager\(\)/);
  assert.match(sql,/azal_manager_can_access/);
  assert.match(sql,/azal_staff_can_access/);
  assert.match(sql,/revoke all on function public\.azal_admin_sales_report/);
  assert.match(sql,/revoke all on function public\.azal_staff_today_summary/);
  assert.doesNotMatch(sql,/guest_email|contact_phone|display_name|customer_note/);
});

test("Manager UI only renders Admin financial columns for Admin; Staff summary has no tax or sending path",()=>{
  const reports=read("reports.js"),staff=read("staff-summary.js"),admin=read("admin.html"),staffHtml=read("staff.html");
  assert.match(reports,/if\(admin\)\{cols\.push\("subtotal_cents","discount_cents","hst_cents","refunds_cents","net_collected_cents"\)/);
  assert.match(reports,/bs\.filter\(b=>a\.branches\.includes\(b\.slug\)\)/);
  assert.match(staff,/azal_staff_today_summary/);
  assert.doesNotMatch(staff,/hst|tax|outbox|smtp|sendEmail|sendmail/i);
  assert.match(staff,/navigator\.clipboard\.writeText/);
  assert.match(admin,/id="reportsRoot"/);
  assert.match(admin,/reports\.js/);
  assert.match(staffHtml,/id="staffSummaryRoot"/);
  assert.match(staffHtml,/staff-summary\.js/);
});
