-- AZAL 0004: real pickup ordering (Claude, owner test mandate 05:20). Apply after 0001 + 0002 + 0003.
-- Clients still cannot write tables. All writes go through these SECURITY DEFINER functions, which
-- re-derive prices, tax, pickup time and capacity on the server. OWNER RULE (05:26): an order must be PAID
-- ONLINE; the kitchen never acts on an unpaid order. Payments run in TEST MODE only (azal-test provider, test
-- tokens, no card number ever reaches the server). A real provider (e.g. Stripe) replaces pay_order_test at
-- go-live; that needs the owner's account (Tier C). Points are earned once, when an order is paid AND handed over.
-- Rules (config constants, docs/p3-pickup-ui.md defaults): prep 20 min; 15-min slots; 6 orders/slot;
-- last pickup = closing - 15 min; ASAP = now + prep rounded up to 5 min; earn 10 pts per $1 of pre-tax
-- subtotal (floored), per the adopted Majlis Option B working draft. Idempotent migration.
begin;

do $azal_0004_preflight$
begin
  if to_regclass('public.orders') is null or to_regprocedure('public.azal_staff_can_access(text)') is null
     or to_regclass('public.memberships') is null then
    raise exception '0004 requires 0001 + 0002 + 0003';
  end if;
end;
$azal_0004_preflight$;

-- Pickup slot for an order (15-minute grid), stored for the capacity check.
alter table public.orders add column if not exists pickup_slot timestamptz;
create index if not exists orders_branch_slot_idx on public.orders (branch_slug, pickup_slot)
  where fulfilment_status <> 'cancelled';

-- --------------------------------------------------------------------------------------------
-- place_order: the only way a customer creates an order.
-- p_items: [{"menu_item_id":"<uuid>","quantity":1..20}, ...] (1..30 lines; duplicates merged)
-- p_pickup_at: null = as soon as possible; otherwise a wanted pickup time (rounded up to the slot)
-- Errors (SQLSTATE P0001, message = stable code): not_signed_in, no_profile, branch_closed_or_unknown,
-- invalid_items, item_unavailable, too_soon, closed, slot_full, idempotency_conflict, note_too_long
-- --------------------------------------------------------------------------------------------
create or replace function public.place_order(
  p_branch text, p_items jsonb, p_pickup_at timestamptz, p_note text, p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $azal_place_order$
declare
  c_prep constant interval := interval '20 minutes';
  c_step constant integer := 15;          -- minutes
  c_slot_cap constant integer := 6;
  c_last_before_close constant interval := interval '15 minutes';
  v_uid uuid := auth.uid();
  v_branch public.branches;
  v_hash text;
  v_existing public.orders;
  v_now timestamptz := now();
  v_local timestamp;
  v_hours public.branch_hours;
  v_open timestamptz; v_close timestamptz; v_first timestamptz; v_last timestamptz;
  v_want timestamptz; v_slot timestamptz;
  v_count integer;
  v_lines jsonb;
  v_subtotal integer := 0; v_tax integer; v_order_id uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  r record;
begin
  if v_uid is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from public.profiles where id = v_uid) then raise exception 'no_profile'; end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 16 and 128 then raise exception 'invalid_items'; end if;
  if v_note is not null and char_length(v_note) > 500 then raise exception 'note_too_long'; end if;

  select * into v_branch from public.branches where slug = p_branch and active;
  if not found then raise exception 'branch_closed_or_unknown'; end if;

  -- Normalise the cart: merge duplicates, validate shape and bounds.
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30 then raise exception 'invalid_items'; end if;
  begin
    select jsonb_agg(jsonb_build_object('id', id, 'q', q) order by id) into v_lines from (
      select (e->>'menu_item_id')::uuid as id, sum((e->>'quantity')::integer) as q
      from jsonb_array_elements(p_items) e group by 1) s;
  exception when others then raise exception 'invalid_items';
  end;
  if exists (select 1 from jsonb_array_elements(v_lines) l where (l->>'q')::integer not between 1 and 20 or l->>'id' is null) then
    raise exception 'invalid_items';
  end if;

  v_hash := encode(sha256(convert_to(p_branch || '|' || v_lines::text || '|' || coalesce(p_pickup_at::text, 'asap') || '|' || coalesce(v_note, ''), 'UTF8')), 'hex');

  -- Idempotency: the same key returns the same order; a different request with the same key is refused.
  select * into v_existing from public.orders where user_id = v_uid and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> v_hash then raise exception 'idempotency_conflict'; end if;
    return jsonb_build_object('order_id', v_existing.id, 'pickup_at', v_existing.scheduled_for, 'subtotal_cents', v_existing.subtotal_cents,
      'tax_cents', v_existing.tax_cents, 'total_cents', v_existing.total_cents, 'status', v_existing.fulfilment_status, 'replayed', true);
  end if;

  -- Pickup time in the branch's local time.
  v_want := coalesce(p_pickup_at, v_now + c_prep);
  if v_want < v_now + c_prep - interval '1 minute' then raise exception 'too_soon'; end if;
  v_local := v_want at time zone v_branch.timezone;
  select * into v_hours from public.branch_hours where branch_slug = p_branch and weekday = extract(dow from v_local)::smallint;
  if not found or v_hours.closed then raise exception 'closed'; end if;
  v_open  := (v_local::date + v_hours.opens_local) at time zone v_branch.timezone;
  v_close := (v_local::date + v_hours.closes_local) at time zone v_branch.timezone;
  if v_close <= v_open then v_close := v_close + interval '1 day'; end if;   -- overnight hours
  v_first := v_open + c_prep;
  v_last := v_close - c_last_before_close;
  if p_pickup_at is null then
    -- ASAP: now + prep, rounded up to 5 minutes, never before the first pickup of the day.
    v_want := greatest(to_timestamp(ceil(extract(epoch from v_want) / 300) * 300), v_first);
  end if;
  if v_want < v_first or v_want > v_last then raise exception 'closed'; end if;
  v_slot := to_timestamp(ceil(extract(epoch from v_want) / (c_step * 60)) * (c_step * 60));
  if v_slot > v_last then v_slot := v_last; end if;

  -- Capacity: serialise per branch+slot, then count.
  perform pg_advisory_xact_lock(hashtext(p_branch || '@' || v_slot::text));
  select count(*) into v_count from public.orders
   where branch_slug = p_branch and pickup_slot = v_slot and fulfilment_status <> 'cancelled'
     and (payment_status = 'paid' or placed_at > v_now - interval '15 minutes');   -- unpaid holds expire
  if v_count >= c_slot_cap then raise exception 'slot_full'; end if;

  -- Server prices only.
  for r in
    select (l->>'id')::uuid as id, (l->>'q')::integer as q, bmi.price_cents, mi.name_en, mi.name_fr, (bmi.available and mi.active) as ok
    from jsonb_array_elements(v_lines) l
    left join public.branch_menu_items bmi on bmi.branch_slug = p_branch and bmi.menu_item_id = (l->>'id')::uuid
    left join public.menu_items mi on mi.id = bmi.menu_item_id
  loop
    if r.ok is not true then raise exception 'item_unavailable'; end if;
    v_subtotal := v_subtotal + r.q * r.price_cents;
  end loop;
  v_tax := (v_subtotal * v_branch.tax_rate_bps + 5000) / 10000;   -- half-up to the cent

  insert into public.orders (branch_slug, user_id, idempotency_key, request_hash, scheduled_for, pickup_slot,
    subtotal_cents, tax_rate_bps, tax_cents, total_cents, customer_note)
  values (p_branch, v_uid, p_idempotency_key, v_hash, v_want, v_slot,
    v_subtotal, v_branch.tax_rate_bps, v_tax, v_subtotal + v_tax, v_note)
  returning id into v_order_id;

  insert into public.order_items (order_id, menu_item_id, item_name_en_snapshot, item_name_fr_snapshot, quantity, unit_price_cents, line_total_cents)
  select v_order_id, mi.id, mi.name_en, mi.name_fr, (l->>'q')::integer, bmi.price_cents, (l->>'q')::integer * bmi.price_cents
  from jsonb_array_elements(v_lines) l
  join public.branch_menu_items bmi on bmi.branch_slug = p_branch and bmi.menu_item_id = (l->>'id')::uuid
  join public.menu_items mi on mi.id = bmi.menu_item_id;

  insert into public.order_events (order_id, actor_user_id, event_type, to_status, details)
  values (v_order_id, v_uid, 'placed', 'placed', jsonb_build_object('pickup_at', v_want, 'asap', p_pickup_at is null));

  return jsonb_build_object('order_id', v_order_id, 'pickup_at', v_want, 'subtotal_cents', v_subtotal,
    'tax_cents', v_tax, 'total_cents', v_subtotal + v_tax, 'status', 'placed', 'replayed', false);
end;
$azal_place_order$;

-- --------------------------------------------------------------------------------------------
-- staff_update_order: staff of the branch (or admin) move a PAID order forward, or cancel.
-- p_action: accept | prepare | ready | hand_over | cancel. Unpaid orders cannot be worked on (owner rule).
-- Cancelling a paid order records a test refund (test mode only; real refunds come with the real provider).
-- Earns points exactly once when the order is paid AND handed over.
-- --------------------------------------------------------------------------------------------
create or replace function public.staff_update_order(p_order uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $azal_staff_update_order$
declare
  v_o public.orders;
  v_from text;
  v_to text;
  v_points integer;
begin
  select * into v_o from public.orders where id = p_order for update;
  if not found then raise exception 'order_not_found'; end if;
  if not public.azal_staff_can_access(v_o.branch_slug) then raise exception 'not_staff'; end if;
  v_from := v_o.fulfilment_status;
  if v_from in ('handed_over', 'cancelled') then raise exception 'order_closed'; end if;
  if p_action <> 'cancel' and v_o.payment_status <> 'paid' then raise exception 'unpaid_order'; end if;

  v_to := case p_action
    when 'accept' then case when v_from = 'placed' then 'accepted' end
    when 'prepare' then case when v_from in ('placed','accepted') then 'preparing' end
    when 'ready' then case when v_from in ('accepted','preparing') then 'ready' end
    when 'hand_over' then case when v_from = 'ready' then 'handed_over' end
    when 'cancel' then 'cancelled'
  end;
  if v_to is null then raise exception 'bad_transition'; end if;

  if v_to = 'cancelled' and v_o.payment_status = 'paid' then
    if coalesce((select value from public.app_settings where key = 'payments_mode'), 'off') <> 'test' then
      raise exception 'refund_requires_provider';
    end if;
    insert into public.payment_events (order_id, provider, provider_event_id, event_type, amount_cents)
    values (p_order, 'azal-test', 'test_refund_' || p_order, 'refund_succeeded', v_o.total_cents);
    update public.orders set payment_status = 'refunded' where id = p_order;
  end if;

  update public.orders set fulfilment_status = v_to, updated_at = now(),
    handed_over_at = case when v_to = 'handed_over' then now() else handed_over_at end
   where id = p_order;
  insert into public.order_events (order_id, actor_user_id, event_type, from_status, to_status)
  values (p_order, auth.uid(), p_action, v_from, v_to);

  select * into v_o from public.orders where id = p_order;
  if v_o.payment_status = 'paid' and v_o.fulfilment_status = 'handed_over' then
    v_points := (v_o.subtotal_cents * 10) / 100;   -- 10 pts per $1, floored
    if v_points > 0 then
      insert into public.points_ledger (user_id, order_id, event_key, entry_type, delta_points, reason)
      values (v_o.user_id, v_o.id, 'earn:' || v_o.id, 'earn', v_points, 'Order ' || v_o.id || ' paid and collected')
      on conflict do nothing;
    end if;
  end if;
  return jsonb_build_object('order_id', p_order, 'fulfilment_status', v_o.fulfilment_status, 'payment_status', v_o.payment_status);
end;
$azal_staff_update_order$;

-- --------------------------------------------------------------------------------------------
-- TEST-MODE payments. app_settings is server-only (RLS on, no policies, no client grants).
-- pay_order_test(order, token): the customer pays their own unpaid order with a TEST token.
-- Tokens (the browser maps test card numbers to these; real card numbers are refused in the browser and
-- never sent): tok_test_ok -> paid; tok_test_declined -> declined; tok_test_insufficient -> declined.
-- Errors: not_signed_in, order_not_found, payments_not_in_test_mode, already_paid, order_closed,
-- invalid_test_token, payment_window_expired (unpaid > 15 min: start a new order)
-- --------------------------------------------------------------------------------------------
create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
revoke all on table public.app_settings from anon, authenticated;
insert into public.app_settings (key, value) values ('payments_mode', 'test') on conflict (key) do nothing;

create or replace function public.pay_order_test(p_order uuid, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $azal_pay_order_test$
declare
  v_uid uuid := auth.uid();
  v_o public.orders;
  v_outcome text;
begin
  if v_uid is null then raise exception 'not_signed_in'; end if;
  if coalesce((select value from public.app_settings where key = 'payments_mode'), 'off') <> 'test' then
    raise exception 'payments_not_in_test_mode';
  end if;
  select * into v_o from public.orders where id = p_order and user_id = v_uid for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_o.payment_status = 'paid' then raise exception 'already_paid'; end if;
  if v_o.fulfilment_status = 'cancelled' or v_o.payment_status <> 'unpaid' then raise exception 'order_closed'; end if;
  if v_o.placed_at < now() - interval '15 minutes' then raise exception 'payment_window_expired'; end if;
  v_outcome := case p_token when 'tok_test_ok' then 'paid' when 'tok_test_declined' then 'declined'
                            when 'tok_test_insufficient' then 'declined' end;
  if v_outcome is null then raise exception 'invalid_test_token'; end if;

  insert into public.payment_events (order_id, provider, provider_event_id, event_type, amount_cents)
  values (p_order, 'azal-test', 'test_' || gen_random_uuid(), case when v_outcome = 'paid' then 'payment_succeeded' else 'payment_failed' end,
          case when v_outcome = 'paid' then v_o.total_cents else 0 end);
  if v_outcome = 'paid' then
    update public.orders set payment_status = 'paid', updated_at = now() where id = p_order;
    insert into public.order_events (order_id, actor_user_id, event_type, from_status, to_status, details)
    values (p_order, v_uid, 'paid', 'unpaid', 'paid', jsonb_build_object('provider', 'azal-test'));
  end if;
  return jsonb_build_object('order_id', p_order, 'outcome', v_outcome,
    'reason', case p_token when 'tok_test_insufficient' then 'insufficient_funds' when 'tok_test_declined' then 'card_declined' end,
    'total_cents', v_o.total_cents);
end;
$azal_pay_order_test$;

-- Grants: nothing for anon or PUBLIC; signed-in users may call; staff checks happen inside.
revoke all on function public.place_order(text, jsonb, timestamptz, text, text) from public, anon;
revoke all on function public.staff_update_order(uuid, text) from public, anon;
revoke all on function public.pay_order_test(uuid, text) from public, anon;
grant execute on function public.place_order(text, jsonb, timestamptz, text, text) to authenticated;
grant execute on function public.staff_update_order(uuid, text) to authenticated;
grant execute on function public.pay_order_test(uuid, text) to authenticated;
-- The new column inherits the table-level revokes of 0002; restate client DML revoke for safety.
revoke insert, update, delete, truncate on table public.orders from anon, authenticated;

commit;
