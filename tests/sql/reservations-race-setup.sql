-- Race setup: branch 'rc' (50 seats), 9 bookings already made from IP 203.0.113.50 (limit 10/h),
-- and 9 cancel attempts already logged from IP 198.51.100.60 (limit 10 per 15 min).
insert into public.branches(slug,name_en,name_fr,city,timezone,tax_rate_bps) values ('rc','R','R','Toronto','America/Toronto',1300) on conflict do nothing;
insert into public.branch_hours(branch_slug,weekday,opens_local,closes_local,closed) select 'rc', d, '11:00','21:00', false from generate_series(0,6) d on conflict do nothing;
insert into public.reservation_settings(branch_slug, booking_enabled) values ('rc', true) on conflict do nothing;
select set_config('request.headers', '{"x-forwarded-for":"203.0.113.50"}', false);
select count(public.reserve_table('rc', (((now() at time zone 'America/Toronto')::date + 2) + make_time(11, 0, 0)) at time zone 'America/Toronto' + i * interval '30 minutes', 1, 'S', 'seed'||i||'@example.invalid', '61355500'||lpad(i::text,2,'0'), 'race-seed-key-'||lpad(i::text,4,'0'))) from generate_series(1,9) i;
select set_config('request.headers', '{"x-forwarded-for":"198.51.100.60"}', false);
select count(public.cancel_reservation('Q'||lpad(i::text,7,'Q'), 'nobody@example.invalid')) from generate_series(1,9) i;
