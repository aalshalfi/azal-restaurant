# Applying 0013 (membership numbers) — Muse only

**When:** AFTER the T-23 member-page change is merged and deployed (the page shows the number only once the column exists).

1. **Preflight** (SQL editor):
   `select count(*) as profiles, count(*) filter (where created_at is null) as no_date from public.profiles;`
   `select column_name from information_schema.columns where table_name='profiles' and column_name='member_number';` → expect no row.
2. **Backup:** take a snapshot of `public.profiles` (Table editor → Export CSV) before running.
3. **Run** `supabase/migrations/0013_member_number.sql` once (it is safe to re-run).
4. **Post-checks:**
   - `select u.email, p.member_number, p.created_at from public.profiles p join auth.users u on u.id=p.id order by p.member_number;` → 10001, 10002, … in registration order, no gaps.
   - `select last_number from public.azal_member_counter;` → equals the highest number.
   - The profile count is unchanged from step 1.
5. **Rollback** (only if a post-check fails, before anyone registers):
   `drop trigger profiles_assign_member_number on public.profiles; drop trigger profiles_keep_member_number on public.profiles; alter table public.profiles drop column member_number; drop table public.azal_member_counter; drop function public.azal_assign_member_number(), public.azal_keep_member_number();`
