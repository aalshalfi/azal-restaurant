-- Session a: 10th cancel guess from the same IP (different code), then hold the transaction 1 s.
\set ON_ERROR_STOP 1
begin;
select set_config('request.headers', '{"x-forwarded-for":"198.51.100.60"}', true);
select 'cancel-a ' || (public.cancel_reservation('RACEAAAA', 'nobody@example.invalid')->>'status');
select pg_sleep(1);
commit;
