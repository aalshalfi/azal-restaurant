insert into public.branches(slug,name_en,name_fr,city,timezone,tax_rate_bps) values ('cc','C','C','Toronto','America/Toronto',1300) on conflict do nothing;
insert into public.branch_hours(branch_slug,weekday,opens_local,closes_local,closed) select 'cc', d, '11:00','21:00', false from generate_series(0,6) d on conflict do nothing;
insert into public.reservation_settings(branch_slug, seats) values ('cc', 10) on conflict do nothing;
