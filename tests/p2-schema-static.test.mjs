import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sql = fs.readFileSync(path.join(root, "supabase/migrations/0002_p2_fixes.sql"), "utf8");

test("R1: branch-less admin access is independent of staff branch joins", () => {
  const start = sql.indexOf("create or replace function public.azal_staff_can_access");
  const end = sql.indexOf("$azal_staff_access$;", start) + "$azal_staff_access$;".length;
  const fn = sql.slice(start, end);
  assert.ok(start >= 0 && end > start, "azal_staff_can_access function is missing");
  assert.ok(fn.includes("auth.uid() is not null"));
  assert.ok(fn.includes("public.azal_is_admin()"));
  assert.ok(fn.includes("r.role = 'staff'"));
  assert.ok(!fn.includes("r.role in ('staff','admin')"), "admin must not depend on a staff branch join");
});

test("R2: ledger enforces one earn, reversal and redemption refund per order", () => {
  const expected = [
    ["points_ledger_one_earn_per_order_idx", "entry_type = 'earn'"],
    ["points_ledger_one_earn_reversal_per_order_idx", "entry_type = 'earn_reversal'"],
    ["points_ledger_one_redeem_refund_per_order_idx", "entry_type = 'redeem_refund'"],
  ];
  for (const [name, predicate] of expected) {
    const at = sql.indexOf(`create unique index if not exists ${name}`);
    assert.ok(at >= 0, `missing partial unique index ${name}`);
    const end = sql.indexOf(";", at);
    const statement = sql.slice(at, end + 1);
    assert.ok(statement.includes("on public.points_ledger (order_id)"));
    assert.ok(statement.includes("where order_id is not null"));
    assert.ok(statement.includes(predicate));
  }
});

test("R3: Auth insert creates a minimal profile through a locked-down trigger", () => {
  const start = sql.indexOf("create or replace function public.handle_new_user()");
  const end = sql.indexOf("$azal_handle_new_user$;", start) + "$azal_handle_new_user$;".length;
  const fn = sql.slice(start, end);
  assert.ok(start >= 0 && end > start, "handle_new_user function is missing");
  assert.ok(fn.includes("security definer"));
  assert.ok(fn.includes("set search_path = pg_catalog, public"));
  assert.ok(fn.includes("insert into public.profiles (id)"));
  assert.ok(fn.includes("values (new.id)"));
  assert.ok(fn.includes("on conflict (id) do nothing"));
  assert.ok(!fn.includes("raw_user_meta_data") && !fn.includes("display_name"), "trigger must not copy personal metadata");
  assert.ok(sql.includes("revoke all on function public.handle_new_user() from public, anon, authenticated"));
  assert.ok(sql.includes("create trigger azal_handle_new_user_after_insert"));
  assert.ok(sql.includes("after insert on auth.users"));
});

test("P2 apply runbook preserves the C-REV/Muse gate and exact staging target", () => {
  const runbook = fs.readFileSync(path.join(root, "docs/p2-staging-apply.md"), "utf8");
  assert.ok(runbook.includes("DO NOT APPLY YET"));
  assert.ok(runbook.includes("0002_p2_fixes.sql"));
  assert.ok(runbook.includes("0001_azal_staging_baseline.sql"));
  assert.ok(runbook.includes("nrnkhnmlgkjytyryinlj"));
  assert.ok(runbook.includes("Claude static C-REV PASS"));
  assert.ok(runbook.includes("Muse's explicit approval"));
  assert.ok(runbook.includes("Yemen Gate projects remain hands-off"));
});


test("C-REV Q5: client table DML is revoked globally and only profile name update is restored", () => {
  assert.ok(sql.includes("revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated"));
  assert.ok(sql.includes("revoke update (display_name) on table public.profiles from anon, authenticated"));
  assert.ok(sql.includes("grant update (display_name) on public.profiles to authenticated"));
  const runbook = fs.readFileSync(path.join(root, "docs/p2-staging-apply.md"), "utf8");
  assert.ok(runbook.includes("docs/supabase-verify.sql"));
  assert.ok(runbook.includes("exactly one row — `authenticated | profiles | display_name | UPDATE`"));
  assert.ok(runbook.includes("information_schema.column_privileges"));
});


test("P2 is an incremental patch and never recreates baseline tables or policies", () => {
  assert.ok(sql.includes("to_regclass('public.profiles')"), "patch must fail closed if baseline schema is absent");
  assert.ok(!/create\\s+table/i.test(sql), "incremental patch must not create or replace tables");
  assert.ok(!/create\\s+policy/i.test(sql), "incremental patch must not recreate baseline policies");
  assert.ok(fs.existsSync(path.join(root, "docs/schema-reference/0001_azal_staging_baseline.sql")), "original 0001 baseline must be preserved as reference only");
});
