\set ON_ERROR_STOP 1
begin;
create function public.zz_reject_try(sql text) returns text language plpgsql as $$
begin execute sql; return 'ok'; exception when others then return sqlerrm; end $$;
grant execute on function public.zz_reject_try(text) to anon, authenticated;

insert into public.branches(slug,name_en,name_fr,city,timezone,tax_rate_bps)
values ('reject-test','Test','Test','Toronto','America/Toronto',1300),
       ('reject-other','Other','Autre','Toronto','America/Toronto',1300);
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-0000000000c1','customer@example.invalid'),
 ('00000000-0000-0000-0000-0000000000c2','other@example.invalid'),
 ('00000000-0000-0000-0000-0000000000f1','staff@example.invalid'),
 ('00000000-0000-0000-0000-0000000000f2','otherstaff@example.invalid'),
 ('00000000-0000-0000-0000-0000000000f3','admin@example.invalid');
insert into public.user_roles(user_id,role) values
 ('00000000-0000-0000-0000-0000000000f1','staff'),
 ('00000000-0000-0000-0000-0000000000f2','staff'),
 ('00000000-0000-0000-0000-0000000000f3','admin');
insert into public.staff_branch_access(user_id,branch_slug) values
 ('00000000-0000-0000-0000-0000000000f1','reject-test'),
 ('00000000-0000-0000-0000-0000000000f2','reject-other'),
 ('00000000-0000-0000-0000-0000000000f3','reject-test');
insert into public.orders(id,branch_slug,user_id,idempotency_key,request_hash,fulfilment_status,payment_status,subtotal_cents,tax_rate_bps,tax_cents,total_cents)
values
 ('00000000-0000-0000-0000-000000000001','reject-test','00000000-0000-0000-0000-0000000000c1','reject-test-key-0001',repeat('a',64),'placed','paid',100,0,0,100),
 ('00000000-0000-0000-0000-000000000002','reject-test','00000000-0000-0000-0000-0000000000c1','reject-test-key-0002',repeat('b',64),'placed','unpaid',100,0,0,100);

do $$ begin
  if has_function_privilege('anon', 'public.staff_update_order(uuid,text,text)', 'execute') then raise exception 'anon may execute'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',true);
set local role authenticated;
do $$ begin
  if public.zz_reject_try($q$select public.staff_update_order('00000000-0000-0000-0000-000000000001','reject','no')$q$) <> 'not_staff' then raise exception 'customer allowed'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000f2',true);
do $$ begin
  if public.zz_reject_try($q$select public.staff_update_order('00000000-0000-0000-0000-000000000001','reject','no')$q$) <> 'not_staff' then raise exception 'cross-branch staff allowed'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000f1',true);
do $$ begin
  if public.zz_reject_try($q$select public.staff_update_order('00000000-0000-0000-0000-000000000001','reject',null)$q$) <> 'reason_required' then raise exception 'null reason allowed'; end if;
  if public.zz_reject_try($q$select public.staff_update_order('00000000-0000-0000-0000-000000000001','reject',E' \t\n ')$q$) <> 'reason_required' then raise exception 'blank reason allowed'; end if;
  if public.zz_reject_try($q$select public.staff_update_order('00000000-0000-0000-0000-000000000001','reject',repeat('x',501))$q$) <> 'reason_too_long' then raise exception 'long reason allowed'; end if;
  if public.zz_reject_try($q$select public.staff_update_order('00000000-0000-0000-0000-000000000002','reject','no')$q$) <> 'unpaid_order' then raise exception 'unpaid allowed'; end if;
  if public.zz_reject_try($q$select public.staff_update_order('00000000-0000-0000-0000-000000000001','accept','no')$q$) <> 'bad_transition' then raise exception 'other action allowed'; end if;
  perform public.staff_update_order('00000000-0000-0000-0000-000000000001','reject','  Sold out  ');
  if public.zz_reject_try($q$select public.staff_update_order('00000000-0000-0000-0000-000000000001','reject','again')$q$) <> 'order_closed' then raise exception 'repeat allowed'; end if;
  if exists (select 1 from public.orders where id = '00000000-0000-0000-0000-000000000001' and payment_status = 'paid' and fulfilment_status not in ('handed_over','cancelled')) then raise exception 'still in queue'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',true);
do $$ begin
  if not exists (select 1 from public.orders where id = '00000000-0000-0000-0000-000000000001' and fulfilment_status = 'cancelled' and payment_status = 'paid' and rejection_reason = 'Sold out') then raise exception 'customer history missing'; end if;
  if (select count(*) from public.order_events where order_id = '00000000-0000-0000-0000-000000000001' and event_type = 'reject' and actor_user_id = '00000000-0000-0000-0000-0000000000f1' and from_status = 'placed' and to_status = 'cancelled' and details->>'reason' = 'Sold out') <> 1 then raise exception 'audit missing'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c2',true);
do $$ begin
  if exists (select 1 from public.orders where id = '00000000-0000-0000-0000-000000000001') or exists (select 1 from public.order_events where order_id = '00000000-0000-0000-0000-000000000001') then raise exception 'other customer sees rejection'; end if;
end $$;
reset role;
do $$ begin
  if exists (select 1 from public.payment_events where order_id = '00000000-0000-0000-0000-000000000001') or exists (select 1 from public.points_ledger where order_id = '00000000-0000-0000-0000-000000000001') then raise exception 'rejection changed money or points'; end if;
end $$;
select 'PASS kitchen rejection authorization, validation, audit, queue, history and payment';
rollback;
