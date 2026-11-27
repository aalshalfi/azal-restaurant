-- AZAL STAGING seed: the 9 ILLUSTRATIVE sample dishes and prices from the public preview, on the existing
-- fixture branch 'ottawa' ("AZAL Ottawa (concept)" from 0001). For the owner's end-to-end test only.
-- NOT real menu, prices or hours (Tier C, owner-supplied later). Hours: provisional 11:00-21:00 daily (lead default).
-- Repeatable ON THE CLEAN SAMPLE FIXTURE ONLY. Apply after 0001-0004. Run by the lead only; never on production.
-- WARNING: every ON CONFLICT here is DO UPDATE. A re-run OVERWRITES category names/order, item names/category/active,
-- branch prices/availability/sort order and all seven branch hours. NEVER re-run once the owner has entered real menu
-- data. Before any run: prove the target is staging, record pre-apply counts, and take a backup or row export.
-- Stable ids: the site maps its product ids 1..9 to a2a10000-0000-4000-8000-00000000000N.
begin;

insert into public.menu_categories (slug, name_en, name_fr, sort_order) values
  ('rice', 'Rice & meat', 'Riz et viande', 1),
  ('stews', 'Stews', 'Ragoûts', 2),
  ('small-plates', 'Small plates', 'Petites assiettes', 3),
  ('drinks', 'Drinks', 'Boissons', 4)
on conflict (slug) do update set name_en = excluded.name_en, name_fr = excluded.name_fr, sort_order = excluded.sort_order;

insert into public.menu_items (id, category_id, slug, name_en, name_fr, active)
select v.id::uuid, c.id, v.slug, v.name_en, v.name_fr, true
from (values
  ('a2a10000-0000-4000-8000-000000000001','rice','lamb-mandi','Lamb Mandi','Mandi d’agneau'),
  ('a2a10000-0000-4000-8000-000000000002','rice','chicken-mandi','Chicken Mandi','Mandi au poulet'),
  ('a2a10000-0000-4000-8000-000000000003','rice','lamb-haneeth','Lamb Haneeth','Haneeth d’agneau'),
  ('a2a10000-0000-4000-8000-000000000004','stews','fahsa','Yemeni Fahsa','Fahsa yéménite'),
  ('a2a10000-0000-4000-8000-000000000005','stews','saltah','Yemeni Saltah','Saltah yéménite'),
  ('a2a10000-0000-4000-8000-000000000006','small-plates','sahawiq-bread','Sahawiq & Fresh Bread','Sahawiq et pain frais'),
  ('a2a10000-0000-4000-8000-000000000007','small-plates','hummus','Hummus','Houmous'),
  ('a2a10000-0000-4000-8000-000000000008','drinks','adeni-chai','Adeni Chai','Thé adéni'),
  ('a2a10000-0000-4000-8000-000000000009','drinks','mango-juice','Fresh Mango Juice','Jus de mangue frais')
) as v(id, cat, slug, name_en, name_fr)
join public.menu_categories c on c.slug = v.cat
on conflict (id) do update set name_en = excluded.name_en, name_fr = excluded.name_fr, category_id = excluded.category_id, active = true;

insert into public.branch_menu_items (branch_slug, menu_item_id, price_cents, available, sort_order)
values
  ('ottawa','a2a10000-0000-4000-8000-000000000001',2499,true,1),
  ('ottawa','a2a10000-0000-4000-8000-000000000002',1899,true,2),
  ('ottawa','a2a10000-0000-4000-8000-000000000003',2699,true,3),
  ('ottawa','a2a10000-0000-4000-8000-000000000004',1999,true,4),
  ('ottawa','a2a10000-0000-4000-8000-000000000005',1799,true,5),
  ('ottawa','a2a10000-0000-4000-8000-000000000006',599,true,6),
  ('ottawa','a2a10000-0000-4000-8000-000000000007',799,true,7),
  ('ottawa','a2a10000-0000-4000-8000-000000000008',399,true,8),
  ('ottawa','a2a10000-0000-4000-8000-000000000009',549,true,9)
on conflict (branch_slug, menu_item_id) do update set price_cents = excluded.price_cents, available = true, sort_order = excluded.sort_order;

insert into public.branch_hours (branch_slug, weekday, opens_local, closes_local, closed)
select 'ottawa', d, time '11:00', time '21:00', false from generate_series(0, 6) d
on conflict (branch_slug, weekday) do update set opens_local = excluded.opens_local, closes_local = excluded.closes_local, closed = false;

commit;
