# Apply pack: 0004 ordering functions + staging seed. READY-TO-APPLY (Claude, 2026-11-26 06:35 EST)

**Operator:** Muse only, on project `azal` (staging). Claude and ChatGPT never apply.
**Gate:**
- ChatGPT second-eyes PASS on 0004 at `5d650e4` (PR #29 comment, 11:11Z).
- Claude build green: PG16 80/80, concurrency, 0001→0004 clean.
- 0003 live and verified (Muse 06:06: Q13b = 0).

## Exact files (use these bytes, from `main`)
| File | git blob | sha256 (first 16) |
|---|---|---|
| `supabase/migrations/0004_ordering_functions.sql` (403 lines) | `d0ac8dcd6f6bb297c1aeb6c2b7b59165ee20f422` | `7831b08f41096f6d` |
| `supabase/seed/staging-sample-menu.sql` (48 lines) | `69fa803847097364cb44e2c1c5600f1bceff8f87` | `4b18d742eab63f9a` |

The 0004 on `main` before this commit was an older draft carried in by the #28 merge (payments defaulted to `test`). It was never applied. This commit replaces it with the reviewed version. Check the blob hash before pasting.

## Steps
1. **Preflight:** `select to_regclass('public.app_settings');` → expect `NULL` (0004 not yet applied). If it is not NULL, stop and post the result.
2. **Apply 0004:** paste the whole file into the SQL editor and run it once. It runs as a single transaction and aborts by itself if 0001–0003 are missing.
3. **Verify:** run `docs/apply-0004-checks.sql` and compare with EXPECT:

| Check | EXPECT |
|---|---|
| QA: public functions anon can execute (extension functions excluded) | exactly `pay_order_test`, `place_order` |
| QB: authenticated can execute | all 5: `claim_guest_points`, `my_pending_claims`, `pay_order_test`, `place_order`, `staff_update_order` |
| QC: the same 5 functions | all `prosecdef = t` with `search_path=""` |
| QD: `app_settings` | `claim_days 90`, **`payments_mode off`** |
| QE: `app_settings`, `points_claims` | RLS `t`, client_grants `0` |
| QF: client INSERT/DELETE/TRUNCATE on any public table | **0 rows** |
| QG: `orders.user_id`, `guest_email`, `guest_name`, `pickup_slot` | all nullable `YES` |

   Then also re-run the standing Q1–Q13 + Q13b from `docs/supabase-verify.sql`. EXPECT is unchanged, except that Q2 and Q3 count the 2 new tables and their RLS (no policies).
4. **Seed:** run `supabase/seed/staging-sample-menu.sql`, then run it a second time (it is idempotent). Then run:
   `select (select count(*) from public.menu_items where active), (select count(*) from public.branch_menu_items where branch_slug='ottawa' and available), (select count(*) from public.branch_hours where branch_slug='ottawa' and not closed);` → EXPECT `9 | 9 | 7`. Q12 `branch_hours` becomes 7.
5. **Do NOT** set `payments_mode='test'` as part of this apply. It is a separate, recorded step taken right before the owner's end-to-end test:
   `update public.app_settings set value='test', updated_at=now() where key='payments_mode';`
   Turn it back to `off` afterwards if the project serves anything public.
6. **Auth URL settings** (read-only check now; change only at the owner-test step): Authentication → URL Configuration must allow the redirect `https://aalshalfi.github.io/azal-restaurant/member.html`. This is needed for the emailed sign-in link (see Claude's OTP ruling, CLAUDE-REPLY 06:35).

## Local evidence (Claude, PG16, these exact bytes)
- Chain stub → 0001 → 0002 → 0003 → 0004: clean.
- QA–QG: as EXPECT above.
- Seed applied twice: `9 | 9 | 7`.
- `tests/sql/ordering-behaviour.sql`: 80 PASS, 0 FAIL on a fresh database.
