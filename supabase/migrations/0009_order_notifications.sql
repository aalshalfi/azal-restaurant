-- AZAL 0009: idempotent NEW_ORDER restaurant alert outbox (Muse-approved ChatGPT slice).
-- This records an alert only when an order becomes paid. It does not send email.
-- Sender remains OFF; no SMTP credentials, DNS, Edge Function, or live delivery is configured.
begin;

do $preflight$
begin
  if to_regclass('public.orders') is null
     or to_regclass('public.order_items') is null
     or to_regclass('public.branches') is null
     or to_regclass('public.app_settings') is null then
    raise exception '0009 requires ordering schema 0001-0004';
  end if;
end;
$preflight$;

create table if not exists public.order_notification_settings (
  branch_slug text primary key references public.branches(slug) on delete restrict,
  notify_email text,
  sender_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint order_notification_email_sane check (
    notify_email is null or
    (char_length(notify_email) <= 254 and notify_email ~ '^[^@[:space:]<>(),;:]+@[^@[:space:]<>(),;:]+[.][^@[:space:]<>(),;:]+$')
  ),
  constraint order_notification_sender_stays_off check (sender_enabled = false)
);

-- Known restaurant inbox from the owner's existing reservation-notification configuration.
-- This is only a recipient setting; it does not enable delivery.
insert into public.order_notification_settings (branch_slug, notify_email, sender_enabled)
select b.slug, 'info@azalrestaurant.com', false
from public.branches b
where b.slug = 'ottawa'
on conflict (branch_slug) do nothing;

create table if not exists public.order_outbox (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete restrict,
  event_type text not null check (event_type = 'NEW_ORDER'),
  to_email text,
  payload jsonb not null,
  status text not null default 'blocked'
    check (status in ('blocked','queued','sending','sent','delivered','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  created_at timestamptz not null default now(),
  available_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  provider_message_id text,
  last_error text,
  constraint order_outbox_once_per_event unique (order_id, event_type),
  constraint order_outbox_email_sane check (to_email is null or char_length(to_email) <= 254)
);
create index if not exists order_outbox_pending_idx
  on public.order_outbox (available_at, created_at, id)
  where status in ('queued','failed');

alter table public.order_notification_settings enable row level security;
alter table public.order_outbox enable row level security;
revoke all on public.order_notification_settings, public.order_outbox from public, anon, authenticated;

create or replace function public.azal_enqueue_new_order_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $enqueue$
declare
  v_email text;
  v_payload jsonb;
begin
  if new.payment_status <> 'paid' then
    return new;
  end if;
  select s.notify_email into v_email
  from public.order_notification_settings s
  where s.branch_slug = new.branch_slug;

  select pg_catalog.jsonb_build_object(
    'event_type', 'NEW_ORDER',
    'order_id', o.id::text,
    'order_number', pg_catalog.upper(pg_catalog.left(pg_catalog.replace(o.id::text, '-', ''), 8)),
    'branch', pg_catalog.jsonb_build_object('slug', b.slug, 'name', b.name_en),
    'placed_at', o.placed_at,
    'pickup_at', coalesce(o.scheduled_for, o.pickup_slot),
    'items', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'name', oi.item_name_en_snapshot,
        'quantity', oi.quantity,
        'unit_price_cents', oi.unit_price_cents,
        'line_total_cents', oi.line_total_cents
      ) order by oi.id)
      from public.order_items oi where oi.order_id = o.id
    ), '[]'::jsonb),
    'subtotal_cents', o.subtotal_cents,
    'discount_cents', coalesce(nullif(pg_catalog.to_jsonb(o)->>'discount_cents', '')::integer, 0),
    'tax_cents', o.tax_cents,
    'total_cents', o.total_cents,
    'customer_note', o.customer_note,
    'staff_queue_path', 'staff.html'
  ) into v_payload
  from public.orders o
  join public.branches b on b.slug = o.branch_slug
  where o.id = new.id;

  -- Sender is intentionally hard-disabled in this release. The durable event is visible as blocked,
  -- not delivered, until a separately approved sender/SMTP workstream exists.
  insert into public.order_outbox (order_id, event_type, to_email, payload, status, last_error)
  values (new.id, 'NEW_ORDER', v_email, v_payload, 'blocked',
    case when v_email is null then 'recipient_not_configured' else 'sender_disabled' end)
  on conflict (order_id, event_type) do nothing;

  return new;
end;
$enqueue$;

revoke all on function public.azal_enqueue_new_order_notification() from public, anon, authenticated;

drop trigger if exists orders_new_order_outbox on public.orders;
create trigger orders_new_order_outbox
after update of payment_status on public.orders
for each row execute function public.azal_enqueue_new_order_notification();

commit;
