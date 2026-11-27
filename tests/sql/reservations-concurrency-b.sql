begin;
select (public.reserve_table('cc', (((now() at time zone 'America/Toronto')::date+2)+time '13:00') at time zone 'America/Toronto', 8, 'B', 'b@example.invalid', '3435550002', 'conc-key-b-000001')->>'status');
select pg_sleep(0);
commit;
