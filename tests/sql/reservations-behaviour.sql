-- 0005 reservations: behaviour tests (Claude). Run on a FRESH db after stub + 0001..0005. Lines start PASS/FAIL.
\set ON_ERROR_STOP 0
create or replace function public.zz_try(sql text) returns text language plpgsql as $$
begin execute sql; return 'ok'; exception when others then return coalesce(nullif(sqlerrm,''), sqlstate) || '|' || sqlstate; end $$;
create or replace function public.zz_eq(name text, got text, want text) returns text language sql as $$
select case when got = want or split_part(got,'|',1) = want or split_part(got,'|',2) = want then 'PASS  ' || name else 'FAIL  ' || name || '  (got ' || coalesce(got,'NULL') || ', want ' || want || ')' end $$;
grant execute on function public.zz_try(text), public.zz_eq(text,text,text) to anon, authenticated;

-- Fixtures: branch 'test' open 11:00-21:00 daily, 50 seats, notify to a test inbox; staff f1.
insert into public.branches(slug,name_en,name_fr,city,timezone,tax_rate_bps) values ('test','Test','Test','Toronto','America/Toronto',1300);
insert into public.branch_hours(branch_slug,weekday,opens_local,closes_local,closed) select 'test', d, '11:00','21:00', false from generate_series(0,6) d;
insert into public.reservation_settings(branch_slug, notify_email) values ('test','host@example.invalid');
insert into auth.users(id,email) values ('00000000-0000-0000-0000-0000000000f1','f1@example.invalid'),('00000000-0000-0000-0000-0000000000c1','c1@example.invalid');
insert into public.user_roles(user_id,role) values ('00000000-0000-0000-0000-0000000000f1','staff');
insert into public.staff_branch_access(user_id,branch_slug) values ('00000000-0000-0000-0000-0000000000f1','test');
select zz_eq('ottawa settings seeded: 50 seats, 60 min, 30-min step, party 10, notify info@', (select seats||'/'||dwell_minutes||'/'||step_minutes||'/'||max_party||'/'||notify_email from public.reservation_settings where branch_slug='ottawa'), '50/60/30/10/info@azalrestaurant.com');
-- D = 3 days from today (Toronto); t(h,m) = that local wall time as timestamptz
create or replace function public.zz_t(h int, m int, plus int default 3) returns timestamptz language sql as $$
select (((now() at time zone 'America/Toronto')::date + plus) + make_time(h, m, 0)) at time zone 'America/Toronto' $$;
create or replace function public.zz_day(plus int default 3) returns date language sql as $$ select (now() at time zone 'America/Toronto')::date + plus $$;
grant execute on function public.zz_t(int,int,int), public.zz_day(int) to anon, authenticated;

\echo ===== guest (anon) books
set role anon;
select zz_eq('anon cannot read reservations table', zz_try($$select count(*) from public.reservations$$), '42501');
select zz_eq('anon cannot read the outbox', zz_try($$select count(*) from public.reservation_outbox$$), '42501');
select zz_eq('availability: 19 starts 11:00..20:00 for a party of 2', (select count(*)::text from public.reservation_availability('test', zz_day(), 2)), '19');
select zz_eq('availability: first 11:00, last 20:00 (dwell ends by close)', (select min(starts_at)::text||'|'||max(starts_at)::text from public.reservation_availability('test', zz_day(), 2)), zz_t(11,0)::text||'|'||zz_t(20,0)::text);
select zz_eq('availability: party 11 gets nothing online', (select count(*)::text from public.reservation_availability('test', zz_day(), 11)), '0');
select public.reserve_table('test', zz_t(19,0), 4, '  Sara A. ', ' Sara@Example.invalid ', '(343) 555-0101', 'resv-key-000000001') as r1 \gset
select zz_eq('booking returns an 8-char code', ((:'r1'::jsonb->>'code') ~ '^[A-HJ-KM-NP-Z2-9]{8}$')::text, 'true');
select zz_eq('same key + same request replays the same booking', (public.reserve_table('test', zz_t(19,0), 4, 'Sara A.', 'sara@example.invalid', '343 555 0101', 'resv-key-000000001')->>'code'), :'r1'::jsonb->>'code');
select zz_eq('same key, different request refused', zz_try($$select public.reserve_table('test', zz_t(19,30), 4, 'Sara A.', 'sara@example.invalid', '343 555 0101', 'resv-key-000000001')$$), 'idempotency_conflict');
select zz_eq('missing phone refused', zz_try($$select public.reserve_table('test', zz_t(12,0), 2, 'A', 'a@example.invalid', '', 'resv-key-000000002')$$), 'invalid_phone');
select zz_eq('short phone refused', zz_try($$select public.reserve_table('test', zz_t(12,0), 2, 'A', 'a@example.invalid', '555-0101', 'resv-key-000000003')$$), 'invalid_phone');
select zz_eq('markup in email refused (XSS guard)', zz_try($$select public.reserve_table('test', zz_t(12,0), 2, 'A', '<svg/onload=alert(1)>@example.com', '3435550101', 'resv-key-0000000x1')$$), 'invalid_email');
select zz_eq('bad email refused', zz_try($$select public.reserve_table('test', zz_t(12,0), 2, 'A', 'not-an-email', '3435550101', 'resv-key-000000004')$$), 'invalid_email');
select zz_eq('empty name refused', zz_try($$select public.reserve_table('test', zz_t(12,0), 2, '  ', 'a@example.invalid', '3435550101', 'resv-key-000000005')$$), 'invalid_name');
select zz_eq('party 11 refused online', zz_try($$select public.reserve_table('test', zz_t(12,0), 11, 'A', 'a@example.invalid', '3435550101', 'resv-key-000000006')$$), 'party_too_large');
select zz_eq('party 0 refused', zz_try($$select public.reserve_table('test', zz_t(12,0), 0, 'A', 'a@example.invalid', '3435550101', 'resv-key-000000007')$$), 'invalid');
select zz_eq('off-grid 12:15 refused', zz_try($$select public.reserve_table('test', zz_t(12,15), 2, 'A', 'a@example.invalid', '3435550101', 'resv-key-000000008')$$), 'invalid_time');
select zz_eq('before opening 10:30 refused', zz_try($$select public.reserve_table('test', zz_t(10,30), 2, 'A', 'a@example.invalid', '3435550101', 'resv-key-000000009')$$), 'closed');
select zz_eq('20:30 refused (stay would run past 21:00)', zz_try($$select public.reserve_table('test', zz_t(20,30), 2, 'A', 'a@example.invalid', '3435550101', 'resv-key-000000010')$$), 'closed');
select zz_eq('within the 60-min lead refused', zz_try($$select public.reserve_table('test', to_timestamp(ceil(extract(epoch from now())/1800)*1800), 2, 'A', 'a@example.invalid', '3435550101', 'resv-key-000000011')$$), 'too_soon');
select zz_eq('beyond 30 days refused', zz_try($$select public.reserve_table('test', zz_t(12,0,40), 2, 'A', 'a@example.invalid', '3435550101', 'resv-key-000000012')$$), 'too_far');
reset role;
select zz_eq('stored: trimmed name, lowercased email, phone normalised to +1', (select guest_name||'|'||guest_email||'|'||guest_phone||'|'||party_size||'|'||status from public.reservations where code = :'r1'::jsonb->>'code'), 'Sara A.|sara@example.invalid|+13435550101|4|confirmed');
select zz_eq('ends 60 min after start', (select (ends_at - starts_at)::text from public.reservations where code = :'r1'::jsonb->>'code'), '01:00:00');
select zz_eq('outbox: guest confirmation + restaurant notice, nothing else', (select string_agg(kind||'>'||to_email, ',' order by kind) from public.reservation_outbox), 'guest_confirmation>sara@example.invalid,restaurant_notice>host@example.invalid');
select zz_eq('replay wrote no second booking or email', (select count(*)::text from public.reservations)||'/'||(select count(*)::text from public.reservation_outbox), '1/2');
select zz_eq('event history starts at confirmed', (select string_agg(coalesce(from_status,'-')||'>'||to_status, ',') from public.reservation_events), '->confirmed');
select zz_eq('table has no food/payment/note columns (table-only rule)', (select count(*)::text from information_schema.columns where table_schema='public' and table_name='reservations' and column_name ~ '(note|item|order|pay|deposit|card|menu)'), '0');

\echo ===== capacity (per-tick)
-- 46 more seats at 19:30 (19:30-20:30). With 4 seated at 19:00-20:00, tick 19:30 holds 50: full.
select zz_eq('fill 19:30 to 46 seats with parties of 10/10/10/10/6', (select string_agg(public.reserve_table('test', zz_t(19,30), p, 'G'||i, 'g'||i||'@example.invalid', '343555010'||i, 'cap-key-00000000'||i)->>'status', ',') from (values (1,10),(2,10),(3,10),(4,10),(5,6)) v(i,p)), 'confirmed,confirmed,confirmed,confirmed,confirmed');
select zz_eq('19:00 now refused for 1 (its 19:30 tick is full)', zz_try($$select public.reserve_table('test', zz_t(19,0), 1, 'X', 'x@example.invalid', '3435550199', 'cap-key-000000099')$$), 'slot_full');
select zz_eq('18:30 still fine for 4 (ends 19:30, ticks 18:30 + 19:00 hold 4)', (public.reserve_table('test', zz_t(18,30), 4, 'Y', 'y@example.invalid', '3435550198', 'cap-key-000000098')->>'status'), 'confirmed');
select zz_eq('availability hides 18:30..20:00 for 1 and shows 20:30? no: 18:00 ok, 19:00/19:30/20:00 gone', (select string_agg(to_char(starts_at at time zone 'America/Toronto','HH24:MI'), ',' order by starts_at) from public.reservation_availability('test', zz_day(), 1) where starts_at >= zz_t(18,0)), '18:00,18:30,20:00');
select zz_eq('rate limit: 6th booking for one email in 10 min refused', (select string_agg(coalesce(nullif(split_part(public.zz_try(format('select public.reserve_table(%L, %L, 1, %L, %L, %L, %L)', 'test', zz_t(12,0)+(i*interval '30 min'), 'R', 'r@example.invalid', '3435550111', 'rate-key-00000000'||i)),'|',1),''),'?'), ',') from generate_series(1,6) i), 'ok,ok,ok,ok,ok,rate_limited');

\echo ===== closures
insert into public.reservation_closures(branch_slug, closed_on, reason) values ('test', zz_day(5), 'test closure');
select zz_eq('closed day: no availability', (select count(*)::text from public.reservation_availability('test', zz_day(5), 2)), '0');
select zz_eq('closed day: booking refused', zz_try($$select public.reserve_table('test', zz_t(12,0,5), 2, 'A', 'a2@example.invalid', '3435550101', 'close-key-0000001')$$), 'closed');
update public.branch_hours set closed = true, opens_local = null, closes_local = null where branch_slug='test' and weekday = date_part('dow', zz_day(6))::smallint;
select zz_eq('branch_hours closed weekday: no availability', (select count(*)::text from public.reservation_availability('test', zz_day(6), 2)), '0');

\echo ===== guest cancel
set role anon;
select zz_eq('wrong email cannot cancel (same answer as wrong code)', public.cancel_reservation(:'r1'::jsonb->>'code', 'other@example.invalid')->>'status', 'not_found');
select zz_eq('wrong code cannot cancel', public.cancel_reservation('AAAAAAAA', 'sara@example.invalid')->>'status', 'not_found');
select zz_eq('code + email cancels', (public.cancel_reservation(lower(:'r1'::jsonb->>'code'), 'SARA@example.invalid')->>'status'), 'cancelled');
select zz_eq('cancel again is a replay', (public.cancel_reservation(:'r1'::jsonb->>'code', 'sara@example.invalid')->>'replayed'), 'true');
select zz_eq('anon cannot run host actions', zz_try($$select public.staff_set_reservation_status(gen_random_uuid(),'seated')$$), '42501');
reset role;
select zz_eq('cancel queued one cancellation email', (select count(*)::text from public.reservation_outbox where kind='guest_cancellation'), '1');
select zz_eq('freed seats: 19:00 bookable again for 4', (select count(*)::text from public.reservation_availability('test', zz_day(), 4) where starts_at = zz_t(19,0)), '1');

\echo ===== throttles (not bypassable by changing email)
select set_config('request.headers', '{"x-forwarded-for":"203.0.113.7, 10.0.0.1"}', false) \gset
select zz_eq('per-IP: 10 bookings per hour from one IP, 11th refused even with fresh emails and phones', (select string_agg(coalesce(nullif(split_part(public.zz_try(format('select public.reserve_table(%L, %L, 1, %L, %L, %L, %L)', 'test', zz_t(11,0,2)+(i*interval '30 min'), 'I', 'ip'||i||'@example.invalid', '613555'||lpad(i::text,4,'0'), 'ip-key-000000000'||lpad(i::text,2,'0'))),'|',1),''),'?'), ',') from generate_series(1,11) i), 'ok,ok,ok,ok,ok,ok,ok,ok,ok,ok,rate_limited');
select zz_eq('IP recorded from the first x-forwarded-for hop', (select count(*)::text from public.reservations where created_ip = '203.0.113.7'), '10');
select set_config('request.headers', '{"x-forwarded-for":"198.51.100.9"}', false) \gset
select zz_eq('per-phone: 6th booking for one mobile in an hour refused across emails', (select string_agg(coalesce(nullif(split_part(public.zz_try(format('select public.reserve_table(%L, %L, 1, %L, %L, %L, %L)', 'test', zz_t(11,0,4)+(i*interval '30 min'), 'P', 'ph'||i||'@example.invalid', '613 555 9999', 'ph-key-000000000'||lpad(i::text,2,'0'))),'|',1),''),'?'), ',') from generate_series(1,6) i), 'ok,ok,ok,ok,ok,rate_limited');
select zz_eq('cancel guessing: 5 tries per code in 15 min, then rate_limited', (select string_agg(coalesce(nullif(split_part(public.zz_try(format('select public.cancel_reservation(%L, %L)', 'ZZZZZZZZ', 'x'||i||'@example.invalid')),'|',1),''),'?'), ',') from generate_series(1,6) i), 'ok,ok,ok,ok,ok,rate_limited');
select set_config('request.headers', '{"x-forwarded-for":"192.0.2.44"}', false) \gset
select zz_eq('cancel guessing: 10 tries per IP in 15 min across codes, then rate_limited', (select string_agg(coalesce(nullif(split_part(public.zz_try(format('select public.cancel_reservation(%L, %L)', 'Y'||lpad(i::text,7,'Q'), 'z@example.invalid')),'|',1),''),'?'), ',') from generate_series(1,11) i), 'ok,ok,ok,ok,ok,ok,ok,ok,ok,ok,rate_limited');
select set_config('request.headers', '', false) \gset
select zz_eq('anon cannot read the attempts log', (select has_table_privilege('anon','public.reservation_attempts','select')::text), 'false');
select zz_eq('capacity helper is VOLATILE (fresh snapshot after the lock)', (select provolatile::text from pg_proc where proname='azal_reservation_fits'), 'v');

\echo ===== host stand (staff)
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000f1',false) \gset
set role authenticated;
select zz_eq('staff reads all branch bookings (name, phone, party)', (select (count(*) > 20)::text from public.reservations where branch_slug='test' and guest_phone like '+1%'), 'true');
select (select id from public.reservations where guest_email='y@example.invalid') as y \gset
select zz_eq('no_show refused before start+15', zz_try(format('select public.staff_set_reservation_status(%L,%L)', :'y', 'no_show')), 'bad_transition');
select zz_eq('confirmed -> seated', (public.staff_set_reservation_status(:'y', 'seated')->>'status'), 'seated');
select zz_eq('seated -> completed', (public.staff_set_reservation_status(:'y', 'completed')->>'status'), 'completed');
select zz_eq('completed is final', zz_try(format('select public.staff_set_reservation_status(%L,%L)', :'y', 'seated')), 'bad_transition');
select zz_eq('staff cannot write the table directly', zz_try($$update public.reservations set party_size = 1$$), '42501');
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false) \gset
set role authenticated;
select zz_eq('a signed-in non-staff user reads no bookings', (select count(*)::text from public.reservations), '0');
select zz_eq('non-staff cannot run host actions', zz_try(format('select public.staff_set_reservation_status(%L,%L)', :'y', 'cancelled')), 'not_found');
reset role;

\echo ===== grants and hardening
select zz_eq('anon may execute exactly: availability, reserve, cancel (0005 functions)', (select string_agg(p.proname, ',' order by p.proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('reservation_availability','reserve_table','cancel_reservation','staff_set_reservation_status','azal_reservation_phone','azal_reservation_fits') and has_function_privilege('anon', p.oid, 'execute')), 'cancel_reservation,reservation_availability,reserve_table');
select zz_eq('SECURITY DEFINER functions pin search_path to empty', (select count(*)::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('reservation_availability','reserve_table','cancel_reservation','staff_set_reservation_status') and p.prosecdef and p.proconfig = array['search_path=""']), '4');
select zz_eq('no client INSERT/UPDATE/DELETE on the 6 new tables', (select count(*)::text from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') and table_name like 'reservation%' and privilege_type <> 'SELECT'), '0');
select zz_eq('RLS on all 6 new tables', (select count(*)::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'reservation%' and c.relkind='r' and c.relrowsecurity), '6');
