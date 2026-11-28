-- 0017 T-25/T-26: immutable payment timestamp + role-shaped server-side summaries.
-- Authoring only in this delivery branch. Never apply to Supabase without the lead gate.
begin;

do $preflight$
begin
  if to_regclass('public.orders') is null
     or to_regclass('public.payment_events') is null
     or to_regclass('public.order_events') is null
     or to_regclass('public.user_roles') is null
     or to_regclass('public.staff_branch_access') is null
     or to_regprocedure('public.azal_is_admin()') is null
     or to_regprocedure('public.azal_is_manager()') is null
     or to_regprocedure('public.azal_manager_can_access(text)') is null then
    raise exception '0017 requires the accepted T-14 schema and payment/order event history';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='discount_cents')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='tax_cents')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='total_cents')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='payment_status') then
    raise exception '0017 requires authoritative order financial snapshots';
  end if;
  if exists (
    select 1 from public.orders o
    where o.payment_status in ('paid','refunded')
      and not exists (select 1 from public.payment_events pe where pe.order_id=o.id and pe.event_type='payment_succeeded')
      and not exists (select 1 from public.order_events oe where oe.order_id=o.id and oe.event_type='paid')
  ) then
    raise exception '0017 cannot safely backfill paid_at: paid/refunded order lacks a payment_succeeded or paid event';
  end if;
end;
$preflight$;

alter table public.orders add column if not exists paid_at timestamptz;

-- Recover historical paid time from the immutable provider/test payment event;
-- the order event is a narrowly defined fallback for legacy rows.
update public.orders o
set paid_at = coalesce(
  (select min(pe.received_at) from public.payment_events pe
   where pe.order_id=o.id and pe.event_type='payment_succeeded'),
  (select min(oe.created_at) from public.order_events oe
   where oe.order_id=o.id and oe.event_type='paid')
)
where o.payment_status in ('paid','refunded') and o.paid_at is null;

do $backfill_check$
begin
  if exists (select 1 from public.orders where payment_status in ('paid','refunded') and paid_at is null) then
    raise exception '0017 paid_at backfill incomplete; stop and reconcile source events';
  end if;
end;
$backfill_check$;

create or replace function public.azal_orders_set_paid_at()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if tg_op = 'INSERT' then
    if new.paid_at is not null then
      raise exception 'paid_at_is_server_managed' using errcode='42501';
    end if;
    if new.payment_status in ('paid','refunded') then
      raise exception 'paid_at_requires_payment_transition';
    end if;
    return new;
  end if;

  if old.paid_at is not null and new.paid_at is distinct from old.paid_at then
    raise exception 'paid_at_is_immutable' using errcode='42501';
  end if;
  if old.paid_at is null and new.paid_at is not null then
    raise exception 'paid_at_is_server_managed' using errcode='42501';
  end if;

  if old.payment_status is distinct from 'paid' and new.payment_status='paid' then
    new.paid_at := coalesce(old.paid_at, pg_catalog.clock_timestamp());
  elsif new.payment_status in ('paid','refunded') and coalesce(new.paid_at,old.paid_at) is null then
    raise exception 'paid_at_required_for_paid_order';
  else
    new.paid_at := coalesce(old.paid_at,new.paid_at);
  end if;
  return new;
end;
$fn$;
revoke all on function public.azal_orders_set_paid_at() from public, anon, authenticated;
drop trigger if exists orders_paid_at_immutable on public.orders;
create trigger orders_paid_at_immutable
before insert or update of payment_status, paid_at on public.orders
for each row execute function public.azal_orders_set_paid_at();

alter table public.orders drop constraint if exists orders_paid_at_consistent;
alter table public.orders add constraint orders_paid_at_consistent check (
  (payment_status in ('unpaid','voided') and (paid_at is null or payment_status='voided'))
  or (payment_status in ('paid','refunded') and paid_at is not null)
);
create index if not exists orders_paid_at_branch_idx
  on public.orders (paid_at, branch_slug)
  where paid_at is not null;

-- T-25: one server-side report for Admin and Manager. Manager branch is mandatory
-- and checked against the caller's assigned branches; Admin may pass NULL for all.
create or replace function public.azal_sales_report(
  p_period text,
  p_start_date date,
  p_end_date date,
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
  v_from timestamptz;
  v_until timestamptz;
  v_rows jsonb;
  v_totals jsonb;
begin
  if auth.uid() is null or (not v_admin and not v_manager) then
    raise exception 'not_authorized' using errcode='42501';
  end if;
  if p_period not in ('day','month','year') or p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'invalid_report_period';
  end if;
  if v_manager and (p_branch_slug is null or not public.azal_manager_can_access(p_branch_slug)) then
    raise exception 'branch_forbidden' using errcode='42501';
  end if;
  if v_admin and p_branch_slug is not null and not exists (
    select 1 from public.branches b where b.slug=p_branch_slug
  ) then raise exception 'invalid_branch'; end if;

  v_from := p_start_date::timestamp at time zone 'America/Toronto';
  v_until := (p_end_date + 1)::timestamp at time zone 'America/Toronto';

  with scoped as (
    select o.*
    from public.orders o
    where o.paid_at >= v_from and o.paid_at < v_until
      and o.payment_status in ('paid','refunded')
      and (p_branch_slug is null or o.branch_slug=p_branch_slug)
      and (v_admin or public.azal_manager_can_access(o.branch_slug))
  ), grouped as (
    select date_trunc(p_period, s.paid_at at time zone 'America/Toronto')::date as period_start,
      s.branch_slug,
      count(*)::bigint as order_count,
      count(*) filter (where s.fulfilment_status='placed')::bigint as placed_count,
      count(*) filter (where s.fulfilment_status='accepted')::bigint as accepted_count,
      count(*) filter (where s.fulfilment_status='preparing')::bigint as preparing_count,
      count(*) filter (where s.fulfilment_status='ready')::bigint as ready_count,
      count(*) filter (where s.fulfilment_status='handed_over' and s.payment_status='paid')::bigint as collected_count,
      count(*) filter (where s.fulfilment_status='cancelled')::bigint as cancelled_count,
      coalesce(sum(s.total_cents) filter (where s.fulfilment_status='handed_over' and s.payment_status='paid'),0)::bigint as collected_cents,
      coalesce(sum(s.subtotal_cents) filter (where s.fulfilment_status='handed_over' and s.payment_status='paid'),0)::bigint as subtotal_cents,
      coalesce(sum(s.discount_cents) filter (where s.fulfilment_status='handed_over' and s.payment_status='paid'),0)::bigint as discount_cents,
      coalesce(sum(s.tax_cents) filter (where s.fulfilment_status='handed_over' and s.payment_status='paid'),0)::bigint as tax_cents
    from scoped s
    group by 1,2
  )
  select coalesce(jsonb_agg(
    case when v_admin then jsonb_build_object(
      'period_start',g.period_start,'branch_slug',g.branch_slug,'order_count',g.order_count,
      'placed_count',g.placed_count,'accepted_count',g.accepted_count,'preparing_count',g.preparing_count,
      'ready_count',g.ready_count,'collected_count',g.collected_count,'cancelled_count',g.cancelled_count,
      'collected_cents',g.collected_cents,'subtotal_cents',g.subtotal_cents,
      'discount_cents',g.discount_cents,'tax_cents',g.tax_cents
    ) else jsonb_build_object(
      'period_start',g.period_start,'branch_slug',g.branch_slug,'order_count',g.order_count,
      'placed_count',g.placed_count,'accepted_count',g.accepted_count,'preparing_count',g.preparing_count,
      'ready_count',g.ready_count,'collected_count',g.collected_count,'cancelled_count',g.cancelled_count,
      'collected_cents',g.collected_cents
    ) end order by g.period_start,g.branch_slug
  ),'[]'::jsonb) into v_rows from grouped g;

  with scoped as (
    select o.* from public.orders o
    where o.paid_at >= v_from and o.paid_at < v_until
      and o.payment_status in ('paid','refunded')
      and (p_branch_slug is null or o.branch_slug=p_branch_slug)
      and (v_admin or public.azal_manager_can_access(o.branch_slug))
  )
  select case when v_admin then jsonb_build_object(
    'order_count',count(*),
    'collected_count',count(*) filter(where fulfilment_status='handed_over' and payment_status='paid'),
    'collected_cents',coalesce(sum(total_cents) filter(where fulfilment_status='handed_over' and payment_status='paid'),0),
    'subtotal_cents',coalesce(sum(subtotal_cents) filter(where fulfilment_status='handed_over' and payment_status='paid'),0),
    'discount_cents',coalesce(sum(discount_cents) filter(where fulfilment_status='handed_over' and payment_status='paid'),0),
    'tax_cents',coalesce(sum(tax_cents) filter(where fulfilment_status='handed_over' and payment_status='paid'),0)
  ) else jsonb_build_object(
    'order_count',count(*),
    'collected_count',count(*) filter(where fulfilment_status='handed_over' and payment_status='paid'),
    'collected_cents',coalesce(sum(total_cents) filter(where fulfilment_status='handed_over' and payment_status='paid'),0)
  ) end into v_totals from scoped;

  return jsonb_build_object('role',case when v_admin then 'admin' else 'manager' end,
    'period',p_period,'start_date',p_start_date,'end_date',p_end_date,'rows',v_rows,'totals',v_totals);
end;
$fn$;
revoke all on function public.azal_sales_report(text,date,date,text) from public, anon, authenticated;
grant execute on function public.azal_sales_report(text,date,date,text) to authenticated;

-- T-26: Today's summary for a Staff / branch Orders identity only. The branch is
-- checked against the authenticated staff assignment; Admin/Manager do not borrow this endpoint.
create or replace function public.azal_staff_today_summary(p_branch_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_today date := (pg_catalog.now() at time zone 'America/Toronto')::date;
  v_from timestamptz;
  v_until timestamptz;
  v_result jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.user_roles r
    join public.staff_branch_access a on a.user_id=r.user_id
    where r.user_id=auth.uid() and r.role='staff' and a.branch_slug=p_branch_slug
  ) then raise exception 'not_staff' using errcode='42501'; end if;

  v_from := v_today::timestamp at time zone 'America/Toronto';
  v_until := (v_today + 1)::timestamp at time zone 'America/Toronto';

  select jsonb_build_object(
    'branch_slug',p_branch_slug,'local_date',v_today,
    'order_count',count(*),
    'placed_count',count(*) filter(where fulfilment_status='placed'),
    'accepted_count',count(*) filter(where fulfilment_status='accepted'),
    'preparing_count',count(*) filter(where fulfilment_status='preparing'),
    'ready_count',count(*) filter(where fulfilment_status='ready'),
    'collected_count',count(*) filter(where fulfilment_status='handed_over'),
    'cancelled_count',count(*) filter(where fulfilment_status='cancelled'),
    'collected_cents',coalesce(sum(total_cents) filter(where fulfilment_status='handed_over'),0)
  ) into v_result
  from public.orders
  where branch_slug=p_branch_slug and paid_at >= v_from and paid_at < v_until
    and payment_status='paid';

  return v_result;
end;
$fn$;
revoke all on function public.azal_staff_today_summary(text) from public, anon, authenticated;
grant execute on function public.azal_staff_today_summary(text) to authenticated;

commit;
