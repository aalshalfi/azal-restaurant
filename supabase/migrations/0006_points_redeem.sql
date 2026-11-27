-- AZAL 0006: Majlis points redeemed at checkout (F-OWN-4, owner first test 2026-11-27) (Claude).
-- Apply after 0001-0004 (0005 is independent). Idempotent: safe to run twice. Run by the lead only.
-- Rules:
--  * Rewards are server-configured in app_settings.redeem_tiers as 'points:cents' pairs. Default = adopted Option B
--    (docs/majlis-proposal.md): 5,000 pts = $5 off, 10,000 pts = $10 off. Only an exact tier is accepted.
--  * Members only. The balance is checked when the order is placed AND again, under a per-member lock, when it is
--    paid; the points leave the ledger ('redeem') only on payment, so an unpaid or expired order never strands points.
--  * Cancelling a paid order returns the points once ('redeem_refund'; one per order by index).
--  * The discount is applied before HST (tax on the amount actually charged) and earns no points.
--  * orders gains discount_cents + redeemed_points; total = subtotal - discount + tax.
begin;

do $azal_0006_preflight$
begin
  if (to_regprocedure('public.place_order(text, jsonb, timestamptz, text, text, text, text)') is null
      and to_regprocedure('public.place_order(text, jsonb, timestamptz, text, text, text, text, integer)') is null)
     or to_regclass('public.app_settings') is null then
    raise exception '0006 requires 0004';
  end if;
end;
$azal_0006_preflight$;

-- ---------- schema ----------
alter table public.orders add column if not exists discount_cents integer not null default 0;
alter table public.orders add column if not exists redeemed_points integer not null default 0;
-- The baseline's unnamed column check (total = subtotal + tax) is found by its definition, whatever PG named it.
do $d$ declare c text; begin
  for c in select conname from pg_catalog.pg_constraint where conrelid = 'public.orders'::regclass and contype = 'c'
      and pg_catalog.pg_get_constraintdef(oid) like '%total_cents = (subtotal_cents + tax_cents)%' loop
    execute pg_catalog.format('alter table public.orders drop constraint %I', c);
  end loop;
end $d$;
do $c$ begin
  alter table public.orders add constraint order_total_consistent check (
    discount_cents >= 0 and redeemed_points >= 0 and discount_cents <= subtotal_cents
    and (discount_cents = 0) = (redeemed_points = 0)
    and total_cents = subtotal_cents - discount_cents + tax_cents);
exception when duplicate_object then null; end $c$;
insert into public.app_settings (key, value) values ('redeem_tiers', '5000:500,10000:1000') on conflict (key) do nothing;

-- ---------- helpers (internal; not callable by clients) ----------
create or replace function public.azal_points_balance(p_user uuid)
returns integer language sql stable security definer set search_path = '' as $b$
  select coalesce(pg_catalog.sum(delta_points), 0)::integer from public.points_ledger where user_id = p_user
$b$;
create or replace function public.azal_redeem_tiers()
returns table(points integer, cents integer) language sql stable security definer set search_path = '' as $t$
  select pg_catalog.split_part(t, ':', 1)::integer, pg_catalog.split_part(t, ':', 2)::integer
  from pg_catalog.unnest(pg_catalog.string_to_array(coalesce((select value from public.app_settings where key = 'redeem_tiers'), ''), ',')) t
  where t ~ '^[1-9][0-9]*:[1-9][0-9]*$'
  order by 1
$t$;
create or replace function public.azal_redeem_cents(p_points integer)
returns integer language sql stable security definer set search_path = '' as $r$
  select cents from public.azal_redeem_tiers() where points = p_points
$r$;

-- ---------- redeem_options(): what the signed-in member can use right now ----------
create or replace function public.redeem_options()
returns jsonb language plpgsql stable security definer set search_path = '' as $o$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'signed_out'; end if;
  return pg_catalog.jsonb_build_object('balance', public.azal_points_balance(v_uid),
    'tiers', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('points', points, 'cents', cents) order by points) from public.azal_redeem_tiers()), '[]'::jsonb));
end;
$o$;

-- ---------- place_order (adds p_redeem_points) ----------
drop function if exists public.place_order(text, jsonb, timestamptz, text, text, text, text);
create or replace function public.place_order(
  p_branch text, p_items jsonb, p_pickup_at timestamptz, p_note text, p_idempotency_key text,
  p_guest_name text default null, p_guest_email text default null, p_redeem_points integer default 0)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $azal_place_order$
declare
  c_prep constant interval := interval '20 minutes';
  c_step constant integer := 15;
  c_slot_cap constant integer := 6;
  c_last_before_close constant interval := interval '15 minutes';
  v_uid uuid := auth.uid();
  v_gname text := nullif(pg_catalog.btrim(coalesce(p_guest_name, '')), '');
  v_gemail text := pg_catalog.lower(nullif(pg_catalog.btrim(coalesce(p_guest_email, '')), ''));
  v_branch public.branches;
  v_hash text;
  v_existing public.orders;
  v_now timestamptz := pg_catalog.now();
  v_local timestamp;
  v_hours public.branch_hours;
  v_open timestamptz; v_close timestamptz; v_first timestamptz; v_last timestamptz;
  v_ready timestamptz; v_slot timestamptz;
  v_day date; v_found boolean;
  v_count integer;
  v_lines jsonb;
  v_subtotal integer := 0; v_tax integer; v_order_id uuid;
  v_note text := nullif(pg_catalog.btrim(coalesce(p_note, '')), '');
  r record;
  v_redeem integer := coalesce(p_redeem_points, 0);
  v_discount integer := 0;
begin
  -- Who is ordering.
  if v_uid is not null then
    if v_gname is not null or v_gemail is not null then raise exception 'invalid_guest'; end if;
    if not exists (select 1 from public.profiles where id = v_uid) then raise exception 'no_profile'; end if;
  else
    if v_gname is null or v_gemail is null or pg_catalog.char_length(v_gname) > 80 or pg_catalog.char_length(v_gemail) > 254
       or v_gemail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_guest'; end if;
  end if;
  if p_idempotency_key is null or pg_catalog.char_length(p_idempotency_key) not between 16 and 128 then raise exception 'invalid_items'; end if;
  if v_note is not null and pg_catalog.char_length(v_note) > 500 then raise exception 'note_too_long'; end if;
  -- Points: members only, and only an exact reward tier from app_settings.redeem_tiers (server price, never the client's).
  if v_redeem <> 0 then
    if v_uid is null then raise exception 'redeem_members_only'; end if;
    v_discount := public.azal_redeem_cents(v_redeem);
    if v_discount is null then raise exception 'invalid_redeem'; end if;
  end if;

  -- Strict cart validation before any aggregation (SQL NULL, JSON null, missing/null fields, wrong types).
  if p_items is null or pg_catalog.jsonb_typeof(p_items) <> 'array' or pg_catalog.jsonb_array_length(p_items) not between 1 and 30 then
    raise exception 'invalid_items';
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(p_items) e
    where pg_catalog.jsonb_typeof(e) <> 'object'
       or pg_catalog.jsonb_typeof(e->'menu_item_id') is distinct from 'string'
       or (e->>'menu_item_id') !~ '^[0-9a-fA-F-]{36}$'
       or pg_catalog.jsonb_typeof(e->'quantity') is distinct from 'number'
       or (e->>'quantity') !~ '^[0-9]+$'
       or (e->>'quantity')::integer not between 1 and 20
  ) then raise exception 'invalid_items'; end if;
  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', id, 'q', q) order by id) into v_lines from (
    select (e->>'menu_item_id')::uuid as id, pg_catalog.sum((e->>'quantity')::integer)::integer as q
    from pg_catalog.jsonb_array_elements(p_items) e group by 1) s;
  if exists (select 1 from pg_catalog.jsonb_array_elements(v_lines) l where (l->>'q')::integer > 20) then raise exception 'invalid_items'; end if;

  if p_pickup_at is not null and pg_catalog.date_part('epoch', p_pickup_at)::bigint % (c_step * 60) <> 0 then
    raise exception 'invalid_pickup_time';
  end if;

  v_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    p_branch || '|' || v_lines::text || '|' || coalesce(p_pickup_at::text, 'asap') || '|' || coalesce(v_note, '') || '|' || coalesce(v_gname, '') || case when v_redeem <> 0 then '|redeem:' || v_redeem else '' end, 'UTF8')), 'hex');

  -- Idempotency, serialised per (owner, key): concurrent retries wait here and then replay.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('order-key|' || coalesce(v_uid::text, v_gemail) || '|' || p_idempotency_key));
  if v_uid is not null then
    select * into v_existing from public.orders where user_id = v_uid and idempotency_key = p_idempotency_key;
  else
    select * into v_existing from public.orders where user_id is null and guest_email = v_gemail and idempotency_key = p_idempotency_key;
  end if;
  if found then
    if v_existing.request_hash <> v_hash then raise exception 'idempotency_conflict'; end if;
    return pg_catalog.jsonb_build_object('order_id', v_existing.id, 'pickup_at', v_existing.scheduled_for, 'slot', v_existing.pickup_slot,
      'subtotal_cents', v_existing.subtotal_cents, 'discount_cents', v_existing.discount_cents, 'redeemed_points', v_existing.redeemed_points,
      'tax_cents', v_existing.tax_cents, 'total_cents', v_existing.total_cents,
      'status', v_existing.fulfilment_status, 'payment_status', v_existing.payment_status, 'replayed', true);
  end if;

  -- Balance check only for a NEW order (a replay of a paid order must not fail because its own points were spent).
  if v_redeem <> 0 and public.azal_points_balance(v_uid) < v_redeem then raise exception 'points_insufficient'; end if;

  -- Light abuse guard for guests: at most 5 unpaid orders per email in 15 minutes.
  if v_uid is null and (select pg_catalog.count(*) from public.orders
      where user_id is null and guest_email = v_gemail and payment_status = 'unpaid' and placed_at > v_now - interval '15 minutes') >= 5 then
    raise exception 'rate_limited';
  end if;

  select * into v_branch from public.branches where slug = p_branch and active;
  if not found then raise exception 'branch_closed_or_unknown'; end if;

  -- Pickup time in the branch's local time.
  if p_pickup_at is null then
    v_ready := pg_catalog.to_timestamp(pg_catalog.ceil(pg_catalog.date_part('epoch', v_now + c_prep) / 300) * 300);
  else
    if p_pickup_at < v_now + c_prep - interval '1 minute' then raise exception 'too_soon'; end if;
    v_ready := p_pickup_at;
  end if;
  -- Opening window: a time after midnight may belong to the PREVIOUS day's overnight window (e.g. 18:00-02:00),
  -- so check yesterday's window first, then today's.
  v_local := v_ready at time zone v_branch.timezone;
  v_found := false;
  foreach v_day in array array[v_local::date - 1, v_local::date] loop
    select * into v_hours from public.branch_hours where branch_slug = p_branch and weekday = pg_catalog.date_part('dow', v_day)::smallint;
    continue when not found or v_hours.closed;
    v_open  := (v_day + v_hours.opens_local) at time zone v_branch.timezone;
    v_close := (v_day + v_hours.closes_local) at time zone v_branch.timezone;
    if v_close <= v_open then v_close := v_close + interval '1 day'; end if;   -- overnight window
    v_first := v_open + c_prep;
    v_last := v_close - c_last_before_close;
    if p_pickup_at is null and v_day = v_local::date and v_ready < v_first then v_ready := v_first; end if;
    if v_ready >= v_first and v_ready <= v_last then v_found := true; exit; end if;
  end loop;
  if not v_found then raise exception 'closed'; end if;
  -- Canonical slot: explicit times are already on the grid; ASAP rounds its ready time up to the grid.
  v_slot := pg_catalog.to_timestamp(pg_catalog.ceil(pg_catalog.date_part('epoch', v_ready) / (c_step * 60)) * (c_step * 60));
  if v_slot > v_last then v_slot := pg_catalog.to_timestamp(pg_catalog.floor(pg_catalog.date_part('epoch', v_last) / (c_step * 60)) * (c_step * 60)); end if;

  -- Capacity per branch+slot; unpaid orders hold a place for 15 minutes only.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('slot|' || p_branch || '|' || v_slot::text));
  select pg_catalog.count(*) into v_count from public.orders
   where branch_slug = p_branch and pickup_slot = v_slot and fulfilment_status <> 'cancelled'
     and (payment_status = 'paid' or placed_at > v_now - interval '15 minutes');
  if v_count >= c_slot_cap then raise exception 'slot_full'; end if;

  -- Server prices only.
  for r in
    select (l->>'id')::uuid as id, (l->>'q')::integer as q, bmi.price_cents, (bmi.available and mi.active) as ok
    from pg_catalog.jsonb_array_elements(v_lines) l
    left join public.branch_menu_items bmi on bmi.branch_slug = p_branch and bmi.menu_item_id = (l->>'id')::uuid
    left join public.menu_items mi on mi.id = bmi.menu_item_id
  loop
    if r.ok is not true then raise exception 'item_unavailable'; end if;
    v_subtotal := v_subtotal + r.q * r.price_cents;
  end loop;
  if v_discount > v_subtotal then raise exception 'redeem_exceeds_order'; end if;
  -- HST on the price actually charged: a store-funded points reward reduces the taxable amount (NOT verified by an accountant).
  v_tax := ((v_subtotal - v_discount) * v_branch.tax_rate_bps + 5000) / 10000;   -- half-up to the cent

  insert into public.orders (branch_slug, user_id, guest_name, guest_email, idempotency_key, request_hash, scheduled_for, pickup_slot,
    subtotal_cents, discount_cents, redeemed_points, tax_rate_bps, tax_cents, total_cents, customer_note)
  values (p_branch, v_uid, v_gname, v_gemail, p_idempotency_key, v_hash, v_ready, v_slot,
    v_subtotal, v_discount, v_redeem, v_branch.tax_rate_bps, v_tax, v_subtotal - v_discount + v_tax, v_note)
  returning id into v_order_id;

  insert into public.order_items (order_id, menu_item_id, item_name_en_snapshot, item_name_fr_snapshot, quantity, unit_price_cents, line_total_cents)
  select v_order_id, mi.id, mi.name_en, mi.name_fr, (l->>'q')::integer, bmi.price_cents, (l->>'q')::integer * bmi.price_cents
  from pg_catalog.jsonb_array_elements(v_lines) l
  join public.branch_menu_items bmi on bmi.branch_slug = p_branch and bmi.menu_item_id = (l->>'id')::uuid
  join public.menu_items mi on mi.id = bmi.menu_item_id;

  insert into public.order_events (order_id, actor_user_id, event_type, to_status, details)
  values (v_order_id, v_uid, 'placed', 'placed', pg_catalog.jsonb_build_object('pickup_at', v_ready, 'slot', v_slot, 'asap', p_pickup_at is null, 'guest', v_uid is null, 'redeemed_points', v_redeem));

  return pg_catalog.jsonb_build_object('order_id', v_order_id, 'pickup_at', v_ready, 'slot', v_slot, 'subtotal_cents', v_subtotal,
    'discount_cents', v_discount, 'redeemed_points', v_redeem,
    'tax_cents', v_tax, 'total_cents', v_subtotal - v_discount + v_tax, 'status', 'placed', 'payment_status', 'unpaid', 'replayed', false);
end;
$azal_place_order$;

-- ---------- pay_order_test (debits redeemed points on payment) ----------
create or replace function public.pay_order_test(p_order uuid, p_token text, p_guest_email text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $azal_pay_order_test$
declare
  v_uid uuid := auth.uid();
  v_o public.orders;
  v_outcome text;
begin
  if coalesce((select value from public.app_settings where key = 'payments_mode'), 'off') <> 'test' then
    raise exception 'payments_not_in_test_mode';
  end if;
  if v_uid is not null then
    select * into v_o from public.orders where id = p_order and user_id = v_uid for update;
  else
    select * into v_o from public.orders where id = p_order and user_id is null
      and guest_email = pg_catalog.lower(pg_catalog.btrim(coalesce(p_guest_email, ''))) for update;
  end if;
  if not found then raise exception 'order_not_found'; end if;
  if v_o.payment_status = 'paid' then raise exception 'already_paid'; end if;
  if v_o.fulfilment_status = 'cancelled' or v_o.payment_status <> 'unpaid' then raise exception 'order_closed'; end if;
  if v_o.placed_at < pg_catalog.now() - interval '15 minutes' then raise exception 'payment_window_expired'; end if;
  v_outcome := case p_token when 'tok_test_ok' then 'paid' when 'tok_test_declined' then 'declined'
                            when 'tok_test_insufficient' then 'declined' end;
  if v_outcome is null then raise exception 'invalid_test_token'; end if;
  if v_outcome = 'paid' and v_o.redeemed_points > 0 then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('points|' || v_o.user_id::text));
    if public.azal_points_balance(v_o.user_id) < v_o.redeemed_points then raise exception 'points_insufficient'; end if;
  end if;

  insert into public.payment_events (order_id, provider, provider_event_id, event_type, amount_cents)
  values (p_order, 'azal-test', 'test_' || pg_catalog.gen_random_uuid(), case when v_outcome = 'paid' then 'payment_succeeded' else 'payment_failed' end,
          case when v_outcome = 'paid' then v_o.total_cents else 0 end);
  if v_outcome = 'paid' then
    update public.orders set payment_status = 'paid', updated_at = pg_catalog.now() where id = p_order;
    insert into public.order_events (order_id, actor_user_id, event_type, from_status, to_status, details)
    values (p_order, v_uid, 'paid', 'unpaid', 'paid', pg_catalog.jsonb_build_object('provider', 'azal-test'));
    if v_o.redeemed_points > 0 then
      insert into public.points_ledger (user_id, order_id, event_key, entry_type, delta_points, reason)
      values (v_o.user_id, v_o.id, 'redeem:' || v_o.id, 'redeem', -v_o.redeemed_points, 'Order ' || v_o.id || ' paid with points');
    end if;
  end if;
  return pg_catalog.jsonb_build_object('order_id', p_order, 'outcome', v_outcome,
    'reason', case p_token when 'tok_test_insufficient' then 'insufficient_funds' when 'tok_test_declined' then 'card_declined' end,
    'total_cents', v_o.total_cents);
end;
$azal_pay_order_test$;

-- ---------- staff_update_order (returns points on cancel; earns on the amount paid) ----------
create or replace function public.staff_update_order(p_order uuid, p_action text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $azal_staff_update_order$
declare
  v_o public.orders;
  v_from text;
  v_to text;
  v_points integer;
  v_days integer;
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
    if v_o.redeemed_points > 0 then
      insert into public.points_ledger (user_id, order_id, event_key, entry_type, delta_points, reason)
      values (v_o.user_id, v_o.id, 'redeem_refund:' || v_o.id, 'redeem_refund', v_o.redeemed_points, 'Order ' || v_o.id || ' cancelled: points returned')
      on conflict do nothing;
    end if;
  end if;

  update public.orders set fulfilment_status = v_to, updated_at = pg_catalog.now(),
    handed_over_at = case when v_to = 'handed_over' then pg_catalog.now() else handed_over_at end
   where id = p_order;
  insert into public.order_events (order_id, actor_user_id, event_type, from_status, to_status)
  values (p_order, auth.uid(), p_action, v_from, v_to);

  select * into v_o from public.orders where id = p_order;
  if v_o.payment_status = 'paid' and v_o.fulfilment_status = 'handed_over' then
    v_points := ((v_o.subtotal_cents - v_o.discount_cents) * 10) / 100;   -- 10 pts per $1 actually paid (pre-tax), floored; none on the points discount
    if v_points > 0 then
      if v_o.user_id is not null then
        insert into public.points_ledger (user_id, order_id, event_key, entry_type, delta_points, reason)
        values (v_o.user_id, v_o.id, 'earn:' || v_o.id, 'earn', v_points, 'Order ' || v_o.id || ' paid and collected')
        on conflict do nothing;
      else
        v_days := coalesce((select value::integer from public.app_settings where key = 'claim_days'), 90);
        insert into public.points_claims (order_id, guest_email, points, expires_at)
        values (v_o.id, v_o.guest_email, v_points, pg_catalog.now() + pg_catalog.make_interval(days => v_days))
        on conflict (order_id) do nothing;
      end if;
    end if;
  end if;
  return pg_catalog.jsonb_build_object('order_id', p_order, 'fulfilment_status', v_o.fulfilment_status, 'payment_status', v_o.payment_status);
end;
$azal_staff_update_order$;

-- ---------- grants ----------
revoke all on function public.azal_points_balance(uuid) from public, anon, authenticated;
revoke all on function public.azal_redeem_tiers() from public, anon, authenticated;
revoke all on function public.azal_redeem_cents(integer) from public, anon, authenticated;
revoke all on function public.redeem_options() from public, anon;
grant execute on function public.redeem_options() to authenticated;
revoke all on function public.place_order(text, jsonb, timestamptz, text, text, text, text, integer) from public;
grant execute on function public.place_order(text, jsonb, timestamptz, text, text, text, text, integer) to anon, authenticated;

commit;
