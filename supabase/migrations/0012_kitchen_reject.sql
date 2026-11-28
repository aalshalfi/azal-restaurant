begin;

alter table public.orders add column if not exists rejection_reason text;

create or replace function public.staff_update_order(p_order uuid, p_action text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $reject$
declare
  v_o public.orders;
  v_reason text;
begin
  if p_action is distinct from 'reject' then raise exception 'bad_transition'; end if;
  select * into v_o from public.orders where id = p_order for update;
  if not found then raise exception 'order_not_found'; end if;
  if not public.azal_staff_can_access(v_o.branch_slug) then raise exception 'not_staff'; end if;
  if v_o.fulfilment_status in ('handed_over', 'cancelled') then raise exception 'order_closed'; end if;
  if v_o.payment_status <> 'paid' then raise exception 'unpaid_order'; end if;
  v_reason := pg_catalog.regexp_replace(p_reason, '^[[:space:]]+|[[:space:]]+$', '', 'g');
  if v_reason is null or v_reason = '' then raise exception 'reason_required'; end if;
  if pg_catalog.char_length(v_reason) > 500 then raise exception 'reason_too_long'; end if;

  update public.orders set fulfilment_status = 'cancelled', rejection_reason = v_reason,
    updated_at = pg_catalog.now() where id = p_order;
  insert into public.order_events (order_id, actor_user_id, event_type, from_status, to_status, details)
  values (p_order, auth.uid(), 'reject', v_o.fulfilment_status, 'cancelled',
    pg_catalog.jsonb_build_object('reason', v_reason));
  return pg_catalog.jsonb_build_object('order_id', p_order, 'fulfilment_status', 'cancelled', 'payment_status', v_o.payment_status);
end;
$reject$;

revoke all on function public.staff_update_order(uuid, text, text) from public, anon;
grant execute on function public.staff_update_order(uuid, text, text) to authenticated;

commit;
