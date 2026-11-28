-- T-25 + T-26: paid-time sales reports and branch-bound staff day summary.
-- Payment time is sourced from the immutable payment_events.received_at record for payment_succeeded;
-- the orders table has no paid_at column. No client-side table scan or caller-selected Staff branch is trusted.

begin;

create or replace function public.azal_admin_sales_report(
  p_bucket text,
  p_from date,
  p_to date,
  p_branch_slug text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_admin boolean := public.azal_is_admin();
  v_manager boolean := public.azal_is_manager();
  v_rows jsonb;
  v_manager_scope text[];
begin
  if auth.uid() is null or (not v_admin and not v_manager) then
    raise exception 'not_report_authorized' using errcode='42501';
  end if;
  if p_bucket not in ('day','month','year')
     or p_from is null or p_to is null or p_to <= p_from
     or p_to > p_from + interval '10 years' then
    raise exception 'invalid_report_period';
  end if;

  if v_manager then
    select coalesce(pg_catalog.array_agg(a.branch_slug order by a.branch_slug), array[]::text[])
      into v_manager_scope
      from public.staff_branch_access a
      where a.user_id=auth.uid();
    if cardinality(v_manager_scope)=0
       or (p_branch_slug is not null and not (p_branch_slug = any(v_manager_scope))) then
      raise exception 'not_manager_for_branch' using errcode='42501';
    end if;
  elsif p_branch_slug is not null and not exists (
    select 1 from public.branches b where b.slug=p_branch_slug and b.active
  ) then
    raise exception 'branch_not_found';
  end if;

  with payment_time as (
    select pe.order_id, min(pe.received_at) as paid_at
    from public.payment_events pe
    where pe.event_type='payment_succeeded'
    group by pe.order_id
  ),
  refunds as (
    select pe.order_id, sum(pe.amount_cents)::bigint as refund_cents
    from public.payment_events pe
    where pe.event_type='refund_succeeded'
    group by pe.order_id
  ),
  eligible as (
    select o.id,o.branch_slug,o.fulfilment_status,o.payment_status,
           o.subtotal_cents,o.discount_cents,o.tax_cents,o.total_cents,
           pt.paid_at,
           coalesce(r.refund_cents,0)::bigint as refund_cents,
           (o.fulfilment_status='handed_over') as was_collected
    from public.orders o
    join payment_time pt on pt.order_id=o.id
    left join refunds r on r.order_id=o.id
    where pt.paid_at >= (p_from::timestamp at time zone 'America/Toronto')
      and pt.paid_at < (p_to::timestamp at time zone 'America/Toronto')
      and (
        (v_admin and (p_branch_slug is null or o.branch_slug=p_branch_slug))
        or
        (v_manager and o.branch_slug = any(v_manager_scope))
      )
  ),
  bucketed as (
    select date_trunc(p_bucket, paid_at at time zone 'America/Toronto')::date as period_start,
           count(*)::bigint as paid_orders,
           count(*) filter(where fulfilment_status='placed')::bigint as placed_count,
           count(*) filter(where fulfilment_status='accepted')::bigint as accepted_count,
           count(*) filter(where fulfilment_status='preparing')::bigint as preparing_count,
           count(*) filter(where fulfilment_status='ready')::bigint as ready_count,
           count(*) filter(where fulfilment_status='handed_over')::bigint as handed_over_count,
           count(*) filter(where fulfilment_status='cancelled')::bigint as cancelled_count,
           sum(total_cents) filter(where was_collected)::bigint as collected_cents,
           sum(refund_cents) filter(where was_collected)::bigint as collected_refund_cents,
           sum(subtotal_cents) filter(where v_admin)::bigint as subtotal_cents,
           sum(discount_cents) filter(where v_admin)::bigint as discount_cents,
           sum(tax_cents) filter(where v_admin)::bigint as hst_cents,
           sum(total_cents) filter(where v_admin)::bigint as paid_total_cents,
           sum(refund_cents) filter(where v_admin)::bigint as refunds_cents
    from eligible
    group by 1
  )
  select coalesce(jsonb_agg(
    case when v_admin then jsonb_build_object(
      'period_start',period_start,'paid_orders',paid_orders,
      'placed_count',placed_count,'accepted_count',accepted_count,'preparing_count',preparing_count,
      'ready_count',ready_count,'handed_over_count',handed_over_count,'cancelled_count',cancelled_count,
      'collected_cents',coalesce(collected_cents,0),
      'refunds_cents',coalesce(refunds_cents,0),
      'net_collected_cents',coalesce(collected_cents,0)-coalesce(collected_refund_cents,0),
      'subtotal_cents',coalesce(subtotal_cents,0),'discount_cents',coalesce(discount_cents,0),
      'hst_cents',coalesce(hst_cents,0),'paid_total_cents',coalesce(paid_total_cents,0)
    ) else jsonb_build_object(
      'period_start',period_start,'paid_orders',paid_orders,
      'placed_count',placed_count,'accepted_count',accepted_count,'preparing_count',preparing_count,
      'ready_count',ready_count,'handed_over_count',handed_over_count,'cancelled_count',cancelled_count,
      'collected_cents',coalesce(collected_cents,0)
    ) end order by period_start
  ),'[]'::jsonb) into v_rows
  from bucketed;

  return jsonb_build_object('bucket',p_bucket,'from',p_from,'to',p_to,
    'scope',case when v_admin then 'admin' else 'assigned_branches' end,'rows',v_rows);
end;
$fn$;
revoke all on function public.azal_admin_sales_report(text,date,date,text) from public, anon, authenticated;
grant execute on function public.azal_admin_sales_report(text,date,date,text) to authenticated;

create or replace function public.azal_staff_today_summary(p_branch_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_today date := (pg_catalog.now() at time zone 'America/Toronto')::date;
  v_result jsonb;
begin
  if auth.uid() is null or not exists(
    select 1 from public.user_roles r where r.user_id=auth.uid() and r.role='staff'
  ) or not public.azal_staff_can_access(p_branch_slug) then
    raise exception 'not_staff_for_branch' using errcode='42501';
  end if;

  with payment_time as (
    select pe.order_id,min(pe.received_at) as paid_at
    from public.payment_events pe
    where pe.event_type='payment_succeeded'
    group by pe.order_id
  ),
  today_orders as (
    select o.fulfilment_status,o.total_cents,pt.paid_at
    from public.orders o join payment_time pt on pt.order_id=o.id
    where o.branch_slug=p_branch_slug
      and pt.paid_at >= (v_today::timestamp at time zone 'America/Toronto')
      and pt.paid_at < ((v_today+1)::timestamp at time zone 'America/Toronto')
  )
  select jsonb_build_object(
    'date',v_today,
    'collected_cents',coalesce(sum(total_cents) filter(where fulfilment_status='handed_over'),0),
    'placed_count',count(*) filter(where fulfilment_status='placed'),
    'accepted_count',count(*) filter(where fulfilment_status='accepted'),
    'preparing_count',count(*) filter(where fulfilment_status='preparing'),
    'ready_count',count(*) filter(where fulfilment_status='ready'),
    'handed_over_count',count(*) filter(where fulfilment_status='handed_over'),
    'cancelled_count',count(*) filter(where fulfilment_status='cancelled')
  ) into v_result from today_orders;

  return v_result;
end;
$fn$;
revoke all on function public.azal_staff_today_summary(text) from public, anon, authenticated;
grant execute on function public.azal_staff_today_summary(text) to authenticated;

commit;
