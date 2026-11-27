-- AZAL 0010: a contact mobile on every order (T-02 / F-OWN-16, owner 2026-11-27: "the kitchen must be able to call
-- the customer") (Claude). Apply after 0001-0009. Idempotent: safe to run twice. Run by the lead only.
--  * orders.contact_phone: +E.164 (the profiles rule), NULL allowed for orders placed before 0010 and for members
--    with no mobile on file.
--  * place_order gains p_guest_phone (default null, so existing client calls still match):
--      guest  -> REQUIRED and valid (phone_required / invalid_phone);
--      member -> optional for this order; when absent, the profile mobile is copied onto the order.
--    The phone joins the idempotency hash only when one is sent, so requests made before 0010 replay unchanged.
--  * Readers: staff RLS already lets branch staff read their branch's orders; owners read their own (baseline).
begin;

do $azal_0010_preflight$
begin
  if to_regprocedure('public.place_order(text, jsonb, timestamptz, text, text, text, text, integer)') is null
     and to_regprocedure('public.place_order(text, jsonb, timestamptz, text, text, text, text, integer, text)') is null then
    raise exception '0010 requires 0006 (place_order with p_redeem_points)';
  end if;
  if to_regprocedure('public.azal_phone(text)') is null then
    raise exception '0010 requires 0008 (azal_phone)';
  end if;
end;
$azal_0010_preflight$;

alter table public.orders add column if not exists contact_phone text;
do $c$ begin
  alter table public.orders add constraint order_contact_phone_e164 check (contact_phone is null or contact_phone ~ '^\+[1-9][0-9]{9,14}$');
exception when duplicate_object then null; end $c$;

drop function if exists public.place_order(text, jsonb, timestamptz, text, text, text, text, integer);
create or replace function public.place_order(
  p_branch text, p_items jsonb, p_pickup_at timestamptz, p_note text, p_idempotency_key text,
  p_guest_name text default null, p_guest_email text default null, p_redeem_points integer default 0,
  p_guest_phone text default null)
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
  v_phone text;
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
  -- T-02 / F-OWN-16 (owner: the kitchen must be able to call): a guest gives a valid mobile; a member may give one for
  -- this order, otherwise the profile mobile (0008) is used. Same rule as profiles: azal_phone(), refused, never cleaned.
  if nullif(pg_catalog.btrim(coalesce(p_guest_phone, '')), '') is not null then
    v_phone := public.azal_phone(p_guest_phone);
    if v_phone is null then raise exception 'invalid_phone'; end if;
  elsif v_uid is null then
    raise exception 'phone_required';
  else
    select p.phone into v_phone from public.profiles p where p.id = v_uid;
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
    p_branch || '|' || v_lines::text || '|' || coalesce(p_pickup_at::text, 'asap') || '|' || coalesce(v_note, '') || '|' || coalesce(v_gname, '') || case when v_redeem <> 0 then '|redeem:' || v_redeem else '' end
    || case when nullif(pg_catalog.btrim(coalesce(p_guest_phone, '')), '') is not null then '|phone:' || v_phone else '' end, 'UTF8')), 'hex');

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
    subtotal_cents, discount_cents, redeemed_points, tax_rate_bps, tax_cents, total_cents, customer_note, contact_phone)
  values (p_branch, v_uid, v_gname, v_gemail, p_idempotency_key, v_hash, v_ready, v_slot,
    v_subtotal, v_discount, v_redeem, v_branch.tax_rate_bps, v_tax, v_subtotal - v_discount + v_tax, v_note, v_phone)
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

revoke all on function public.place_order(text, jsonb, timestamptz, text, text, text, text, integer, text) from public;
grant execute on function public.place_order(text, jsonb, timestamptz, text, text, text, text, integer, text) to anon, authenticated;

commit;
