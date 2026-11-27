-- F-OWN-3 order detail: the panel's query, as SQL, under the real RLS (ChatGPT #59 review 5). Stub + 0001-0004 (+0006).
-- This is the SQL equivalent of the PostgREST request (same columns, same filters, same event order); PostgREST's own
-- embedding is not exercised here. Owner sees own order; another member's order id returns nothing; events ordered.
\set ON_ERROR_STOP 0
create or replace function public.zz_eq(name text, got text, want text) returns text language sql as $$
select case when got = want then 'PASS  ' || name else 'FAIL  ' || name || '  (got ' || coalesce(got,'NULL') || ', want ' || want || ')' end $$;
grant execute on function public.zz_eq(text,text,text) to authenticated;
insert into public.branches(slug,name_en,name_fr,city,timezone,tax_rate_bps) values ('test','Test','Test','Toronto','America/Toronto',1300);
insert into public.branch_hours(branch_slug,weekday,opens_local,closes_local,closed) select 'test', d, '00:00','23:59', false from generate_series(0,6) d;
insert into public.menu_items(id,slug,name_en,name_fr,active) values ('00000000-0000-0000-0000-00000000a001','mandi','Lamb Mandi','Mandi',true);
insert into public.branch_menu_items(branch_slug,menu_item_id,price_cents,available) values ('test','00000000-0000-0000-0000-00000000a001',2499,true);
insert into auth.users(id,email) values ('00000000-0000-0000-0000-0000000000c1','c1@example.invalid'),('00000000-0000-0000-0000-0000000000c2','c2@example.invalid');
update public.app_settings set value = 'test' where key = 'payments_mode';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false) \gset
set role authenticated;
select (public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":2}]',null,'no onions','c1-key-000000000001'))->>'order_id' as o1 \gset
select public.pay_order_test(:'o1'::uuid,'tok_test_ok') is not null as p1 \gset
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c2',false) \gset
set role authenticated;
select (public.place_order('test','[{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":1}]',null,'c2 secret note','c2-key-000000000001'))->>'order_id' as o2 \gset
reset role;
-- same-timestamp events to prove the id tiebreak
insert into public.order_events(order_id,event_type,to_status,created_at) select :'o1'::uuid, 'accept', 'accepted', created_at from public.order_events where order_id = :'o1'::uuid and event_type = 'paid';
create or replace function public.zz_detail(p_id uuid) returns jsonb language sql stable as $$
  select jsonb_build_object('id', o.id, 'subtotal_cents', o.subtotal_cents, 'tax_cents', o.tax_cents, 'total_cents', o.total_cents, 'customer_note', o.customer_note,
    'order_items', (select jsonb_agg(jsonb_build_object('quantity', i.quantity, 'unit_price_cents', i.unit_price_cents, 'line_total_cents', i.line_total_cents, 'item_name_en_snapshot', i.item_name_en_snapshot)) from public.order_items i where i.order_id = o.id),
    'order_events', (select jsonb_agg(e.event_type order by e.created_at, e.id) from public.order_events e where e.order_id = o.id))
  from public.orders o where o.id = p_id and o.user_id = auth.uid() limit 1
$$;
grant execute on function public.zz_detail(uuid) to authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false) \gset
set role authenticated;
select zz_eq('owner gets own detail: 2 x 2499 = 4998, note, events in order', (select (d->'order_items'->0->>'line_total_cents') || '|' || (d->>'customer_note') || '|' || (d->'order_events')::text from (select public.zz_detail(:'o1'::uuid) d) x), '4998|no onions|["placed", "paid", "accept"]');
select zz_eq('another member''s order id returns nothing (RLS + user filter)', coalesce(public.zz_detail(:'o2'::uuid)::text, 'none'), 'none');
select zz_eq('even without the client filter, RLS hides c2''s order, items and events', (select count(*) from public.orders where id = :'o2'::uuid)::text || '/' || (select count(*) from public.order_items where order_id = :'o2'::uuid)::text || '/' || (select count(*) from public.order_events where order_id = :'o2'::uuid)::text, '0/0/0');
select zz_eq('c2''s note never readable by c1', (select count(*)::text from public.orders where customer_note like '%c2 secret%'), '0');
reset role;
