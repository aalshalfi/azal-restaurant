// 0003 membership provisioning (Claude): static guards; behaviour verified on local PG16 (see CLAUDE-REPLY).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sql = fs.readFileSync(path.join(root, "supabase/migrations/0003_membership_provisioning.sql"), "utf8");
test("trigger creates profile AND membership, idempotently", () => {
  assert.match(sql, /insert into public\.profiles \(id\)\s+values \(new\.id\)\s+on conflict \(id\) do nothing;/);
  assert.match(sql, /insert into public\.memberships \(user_id\)\s+values \(new\.id\)\s+on conflict \(user_id\) do nothing;/);
});
test("security definer with pinned search_path; not executable by clients", () => {
  assert.match(sql, /security definer\s+set search_path = ''/);
  assert.match(sql, /revoke all on function public\.handle_new_user\(\) from public, anon, authenticated;/);
});
test("backfill for existing profiles; no client write grant on memberships", () => {
  assert.match(sql, /insert into public\.memberships \(user_id\)\s+select p\.id from public\.profiles p\s+on conflict \(user_id\) do nothing;/);
  assert.match(sql, /revoke insert, update, delete, truncate on table public\.memberships from anon, authenticated;/);
  assert.ok(!/grant (insert|update|delete)/i.test(sql));
});
