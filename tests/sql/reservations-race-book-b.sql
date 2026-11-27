-- Session b: 10th booking from the same IP with a fresh email and phone, then hold the transaction 1 s.
\set ON_ERROR_STOP 1
begin;
select set_config('request.headers', '{"x-forwarded-for":"203.0.113.50"}', true);
select 'book-b ' || (public.reserve_table('rc', (((now() at time zone 'America/Toronto')::date + 3) + make_time(13, 0, 0)) at time zone 'America/Toronto', 1, 'R', 'race-b@example.invalid', '6135559802', 'race-book-key-b-00001')->>'status');
select pg_sleep(1);
commit;
