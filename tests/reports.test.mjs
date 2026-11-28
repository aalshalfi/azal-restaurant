import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=(p)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("T-25 migration uses successful payment event time and Toronto-local buckets",()=>{
  const sql=read("supabase/migrations/0017_t25_t26_sales_reports.sql");
  assert.match(sql,/payment_events[\s\S]*received_at/);
  assert.match(sql,/event_type='payment_succeeded'/);
  assert.match(sql,/min\(pe\.received_at\)/);
  assert.match(sql,/America\/Toronto/);
  assert.match(sql,/date_trunc\(p_bucket/);
  assert.match(sql,/p_bucket is null or p_bucket not in \('day','month','year'\)/);
  assert.doesNotMatch(sql,/orders\.paid_at|placed_at|updated_at/);
});

test("T-25 role gates and output shapes are server-enforced",()=>{
  const sql=read("supabase/migrations/0017_t25_t26_sales_reports.sql");
  assert.match(sql,/public\.azal_is_admin\(\)/);
  assert.match(sql,/public\.azal_is_manager\(\)/);
  assert.match(sql,/public\.azal_manager_can_access\(p_branch_slug\)/);
  assert.match(sql,/staff_branch_access/);
  assert.match(sql,/revoke all on function public\.azal_admin_sales_report/);
  assert.match(sql,/grant execute on function public\.azal_admin_sales_report[^;]+to authenticated/);
  assert.match(sql,/subtotal_cents/);
  assert.match(sql,/discount_cents/);
  assert.match(sql,/hst_cents/);
  assert.match(sql,/refunds_cents/);
  assert.match(sql,/net_collected_cents/);
  assert.match(sql,/coalesce\(collected_cents,0\)-coalesce\(collected_refund_cents,0\)/);
  assert.doesNotMatch(sql,/guest_email|contact_phone|display_name|customer_note/);
});

test("T-26 is Staff-only, branch-bound, Toronto-day, and tax-free",()=>{
  const sql=read("supabase/migrations/0017_t25_t26_sales_reports.sql");
  const staff=sql.slice(sql.indexOf("create or replace function public.azal_staff_today_summary"));
  assert.match(staff,/r\.role='staff'/);
  assert.match(staff,/azal_staff_can_access\(p_branch_slug\)/);
  assert.match(staff,/America\/Toronto/);
  assert.match(staff,/refund_cents/);
  assert.match(staff,/collected_cents/);
  assert.doesNotMatch(staff,/hst_cents|subtotal_cents|discount_cents|contact_phone|guest_email/);
  assert.match(staff,/revoke all on function public\.azal_staff_today_summary/);
  assert.match(staff,/grant execute on function public\.azal_staff_today_summary\(text\) to authenticated/);
});

test("PostgreSQL regression suite covers Admin, Manager, Staff and forbidden callers",()=>{
  const sql=read("tests/sql/admin-reports-behaviour.sql");
  for(const token of ["Admin daily report","Admin net collected","Manager report scope","Manager payload omits","Staff today summary","Staff cannot request another branch","Customer cannot invoke sales report","Anonymous cannot execute sales report"])
    assert.ok(sql.includes(token),"missing SQL assertion: "+token);
  assert.match(sql,/Monthly grouping/);
  assert.match(sql,/Yearly grouping/);
});

test("T-25/T-26 UI remains parked until the T-27 shell is adjudicated",()=>{
  const admin=read("admin.html"),staff=read("staff.html"),proposal=read("ADMIN-SHELL-PROPOSAL-CHATGPT.md");
  assert.doesNotMatch(admin,/reports\.js|reportsRoot/);
  assert.doesNotMatch(staff,/staff-summary\.js|staffSummaryRoot/);
  assert.match(proposal,/T-25 is More → Reports/);
  assert.match(proposal,/T-26 is Staff → History/);
  assert.match(proposal,/Manager surface only/);
});
