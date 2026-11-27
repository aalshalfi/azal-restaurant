# Apply 0007 — name and mobile on the member profile (F-OWN-2, F-OWN-8)

**Operator:** Muse (the lead) only. Staging project only. Claude never runs SQL on the live project.
**Depends on:** 0001–0003, which are live. It is independent of 0004–0006.
**Money:** none. No tax or payment rules are involved, so it needs no accountant gate, unlike 0006.

## What changes
- **`profiles.phone`** is new, stored as `+` and the country code (E.164). The database refuses any other shape.
- **`handle_new_user()`** copies the name and mobile that the sign-up form sends (as user metadata) into the profile, after cleaning and checking them. A bad value is simply not stored, and the account is still created. The membership step from 0003 is kept.
- **New function `update_my_profile(p_name, p_phone)`** lets a member change their own name and mobile. It is available to signed-in members only and checks every value on the server. Clients cannot write `phone` directly.
- **Email changes** go through Supabase Auth: it sends a confirmation to the new address. 0007 does not touch email.

## 1. Preflight (read-only)
```sql
select current_database(), (select count(*) from public.profiles) as profiles,
       exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='phone') as has_phone; -- expect false
```

## 2. Backup
Export `public.profiles` (CSV or `pg_dump --data-only -t public.profiles`) and record its row count.

## 3. Apply
Run the file once. It is a single transaction and is safe to run twice.

## 4. Post-checks
```sql
select (select count(*) from public.profiles) as profiles,                                   -- unchanged
       (select count(*) from public.profiles where phone is not null) as with_phone,        -- 0 for existing members
       has_function_privilege('anon', 'public.update_my_profile(text,text)', 'execute') as anon_can_edit,  -- false
       has_column_privilege('authenticated', 'public.profiles', 'phone', 'UPDATE') as client_can_write_phone; -- false
```

## 5. Owner test (no SQL)
1. Join with a name, an email, a mobile such as (343) 999-0001, and a password, then confirm from the email. The member page shows "Your details" with the name and +13439990001.
2. Choose **Edit my details**, change the mobile, and save. The page says "Saved." and shows the new value.
3. Change the email and save. Supabase sends a confirmation to the new address, and the email changes only once that link is opened. This uses Supabase's built-in email, which is rate-limited until custom SMTP is set up (Tier C).

## Rollback
1. Re-run the `handle_new_user()` block from `0003_membership_provisioning.sql`.
2. Run `drop function public.update_my_profile(text, text), public.azal_phone(text), public.azal_clean_name(text);`

The `phone` column may stay. If the owner wants the data removed, run `alter table public.profiles drop column phone;` as well.
