begin;
select (public.reserve_table('cc', (((now() at time zone 'America/Toronto')::date+2)+time '13:00') at time zone 'America/Toronto', 8, 'A', 'a@example.invalid', '3435550001', 'conc-key-a-000001')->>'status');
select pg_sleep(1);
commit;
