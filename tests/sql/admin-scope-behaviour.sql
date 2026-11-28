-- ADM-1 authorization matrix (owner F-OWN-7): what each role can READ and DO, enforced by the database (RLS + RPC
-- checks), not by the page. Run on a FRESH db after stub + 0001-0004. Output lines start with PASS/FAIL.
-- Roles: admin (global), staff A (branch 'ottawa' only), staff B (branch 'second' only), customers c1/c2.
\set ON_ERROR_STOP 0
create or replace function public.zz_try(sql text) returns text language plpgsql as $$
begin execute sql; return 'ok'; exception when others then return coalesce(nullif(sqlerrm,''), sqlstate) || '|' || sqlstate; end $$;
create or replace function public.zz_eq(name text, got text, want text) returns text language sql as $$
select case when got = want or split_part(got,'|',1) = want or split_part(got,'|',2) = want then 'PASS  ' || name else 'FAIL  ' || name || '  (got ' || coalesce(got,'NULL') || ', want ' || want || ')' end $$;
grant execute on function public.zz_try(text), public.zz_eq(text,text,text) to anon, authenticated;

insert into public.branches(slug,name_en,name_fr,city,timezone,tax_rate_bps) values ('ottawa','Ottawa','Ottawa','Ottawa','America/Toronto',1300),('second','Second','Second','Ottawa','America/Toronto',1300) on conflict (slug) do update set active = true;
-- Near-24h overnight window (00:31 to 00:30 next day)s keep ASAP fixtures valid regardless of CI clock time.
insert into public.branch_hours(branch_slug,weekday,opens_local,closes_local,closed) select b, d, '00:31','00:30', false from generate_series(0,6) d, unnest(array['ottawa','second']) b
  on conflict (branch_slug, weekday) do update set opens_local = '00:00', closes_local = '23:59', closed = false;
insert into public.menu_items(id,slug,name_en,name_fr,active) values ('00000000-0000-0000-0000-00000000a001','mandi','Lamb Mandi','Mandi',true);
insert into public.branch_menu_items(branch_slug,menu_item_id,price_cents,available) values ('ottawa','00000000-0000-0000-0000-00000000a001',2499,true),('second','00000000-0000-0000-0000-00000000a001',2499,true) on conflict do nothing;
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-0000000000a0','info@example.invalid'),('00000000-0000-0000-0000-0000000000aa','staffa@example.invalid'),('00000000-0000-0000-0000-0000000000ab','staffb@example.invalid'),
 ('00000000-0000-0000-0000-0000000000c1','c1@example.invalid'),('00000000-0000-0000-0000-0000000000c2','c2@example.invalid');
insert into public.user_roles(user_id,role) values ('00000000-0000-0000-0000-0000000000a0','admin'),('00000000-0000-0000-0000-0000000000aa','staff'),('00000000-0000-0000-0000-0000000000ab','staff');
insert into public.staff_branch_access(user_id,branch_slug) values ('00000000-0000-0000-0000-0000000000aa','ottawa'),('00000000-0000-0000-0000-0000000000ab','second');
update public.app_settings set value = 'test' where key = 'payments_mode';
-- one paid order per customer: c1 at ottawa, c2 at second; plus a points row each
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false) \gset
set role authenticated;
select (public.place_order('ottawa','[{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":1}]',null,null,'c1-key-000000000001'))::text as o1 \gset
select public.pay_order_test((:'o1'::jsonb->>'order_id')::uuid,'tok_test_ok') is not null as paid1 \gset
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c2',false) \gset
set role authenticated;
select (public.place_order('second','[{"menu_item_id":"00000000-0000-0000-0000-00000000a001","quantity":1}]',null,null,'c2-key-000000000001'))::text as o2 \gset
select public.pay_order_test((:'o2'::jsonb->>'order_id')::uuid,'tok_test_ok') is not null as paid2 \gset
reset role;
insert into public.points_ledger(user_id,event_key,entry_type,delta_points,reason) values ('00000000-0000-0000-0000-0000000000c1','seed:c1','earn',300,'fixture'),('00000000-0000-0000-0000-0000000000c2','seed:c2','earn',700,'fixture');

\echo ===== admin: global
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a0',false) \gset
set role authenticated;
select zz_eq('azal_is_admin() is true for the admin', public.azal_is_admin()::text, 'true');
select zz_eq('admin sees orders in BOTH branches', (select string_agg(branch_slug, ',' order by branch_slug) from public.orders), 'ottawa,second');
select zz_eq('admin sees every customer profile', (select count(*)::text from public.profiles where id in ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000c2')), '2');
select zz_eq('admin sees every points row', (select sum(delta_points)::text from public.points_ledger), '1000');
select zz_eq('admin sees all roles and branch assignments', (select count(*)::text from public.user_roles) || '/' || (select count(*)::text from public.staff_branch_access), '3/2');
select zz_eq('admin may work either branch''s order (accept at second)', public.staff_update_order((:'o2'::jsonb->>'order_id')::uuid,'accept')->>'fulfilment_status', 'accepted');
select zz_eq('admin still cannot write the ledger directly', zz_try($$insert into public.points_ledger(user_id,event_key,entry_type,delta_points,reason) values ('00000000-0000-0000-0000-0000000000c1','x','earn',5,'x')$$), '42501');
select zz_eq('admin still cannot grant roles from the client', zz_try($$insert into public.user_roles(user_id,role) values ('00000000-0000-0000-0000-0000000000c1','admin')$$), '42501');
reset role;

\echo ===== staff A: ottawa only, operations only
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000aa',false) \gset
set role authenticated;
select zz_eq('azal_is_admin() is false for staff', public.azal_is_admin()::text, 'false');
select zz_eq('staff A sees only ottawa orders', (select coalesce(string_agg(branch_slug, ','), '∅') from public.orders), 'ottawa');
select zz_eq('staff A cannot read customer profiles', (select count(*)::text from public.profiles where id <> '00000000-0000-0000-0000-0000000000aa'), '0');
select zz_eq('staff A cannot read anyone''s points', (select count(*)::text from public.points_ledger), '0');
select zz_eq('staff A cannot read memberships of customers', (select count(*)::text from public.memberships where user_id <> '00000000-0000-0000-0000-0000000000aa'), '0');
select zz_eq('staff A sees only own role + own branch row', (select count(*)::text from public.user_roles) || '/' || (select string_agg(branch_slug, ',') from public.staff_branch_access), '1/ottawa');
select zz_eq('staff A cannot act on the second branch''s order', zz_try($$select public.staff_update_order('$$ || (:'o2'::jsonb->>'order_id') || $$','ready')$$), 'not_staff');
select zz_eq('staff A accepts its own branch''s order', public.staff_update_order((:'o1'::jsonb->>'order_id')::uuid,'accept')->>'fulfilment_status', 'accepted');
select zz_eq('staff A cannot make itself admin', zz_try($$insert into public.user_roles(user_id,role) values ('00000000-0000-0000-0000-0000000000aa','admin')$$), '42501');
select zz_eq('staff A cannot grant itself another branch', zz_try($$insert into public.staff_branch_access(user_id,branch_slug) values ('00000000-0000-0000-0000-0000000000aa','second')$$), '42501');
select zz_eq('staff A cannot change payment status', zz_try($$update public.orders set payment_status = 'refunded'$$), '42501');
reset role;

\echo ===== staff B: second only
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000ab',false) \gset
set role authenticated;
select zz_eq('staff B sees only second', (select coalesce(string_agg(branch_slug, ','), '∅') from public.orders), 'second');
reset role;

\echo ===== customers: own rows only
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false) \gset
set role authenticated;
select zz_eq('customer c1 is not admin', public.azal_is_admin()::text, 'false');
select zz_eq('c1 sees only its own order', (select count(*)::text from public.orders), '1');
select zz_eq('c1 sees only its own points', (select sum(delta_points)::text from public.points_ledger), '300');
select zz_eq('c1 sees no roles at all', (select count(*)::text from public.user_roles), '0');
select zz_eq('c1 cannot run staff actions', zz_try($$select public.staff_update_order('$$ || (:'o1'::jsonb->>'order_id') || $$','ready')$$), 'not_staff');
reset role;

\echo ===== anon
set role anon;
select zz_eq('anon cannot ask azal_is_admin()', zz_try($$select public.azal_is_admin()$$), '42501');
select zz_eq('anon reads no orders', zz_try($$select count(*) from public.orders$$), '42501');
reset role;
