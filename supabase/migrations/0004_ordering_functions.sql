-- AZAL 0004: real pickup ordering + test-mode payments + guest points claims (Claude).
-- Apply after 0001 + 0002 + 0003. Idempotent: safe to run twice.
-- Owner/lead rules this file implements:
--  * Orders must be PAID ONLINE before the kitchen acts (owner 05:26). Payments are TEST MODE only (provider
--    'azal-test', test tokens; no card number ever reaches the server). A real provider replaces
--    pay_order_test at go-live on the owner's own account (Tier C).
--  * Guests can order with name + email (Proposal A, adopted). A guest order that is paid AND handed over
--    creates a PENDING points claim (never points on placement or cancellation). The guest claims it once,
--    after verifying the same email (OTP sign-in), within a configurable window (default 90 days).
--  * Members earn 10 pts per $1 of pre-tax subtotal, floored, once, on paid + handed over (Option B draft).
-- Hardening: every SECURITY DEFINER function uses search_path = '' and schema-qualified names.
begin;

do $azal_0004_preflight$
begin
  if to_regclass('public.orders') is null or to_regprocedure('public.azal_staff_can_access(text)') is null
     or to_regclass('public.memberships') is null then
    raise exception '0004 requires 0001 + 0002 + 0003';
  end if;
end;
$azal_0004_preflight$;

-- ---------- schema changes ----------
alter table public.orders add column if not exists pickup_slot timestamptz;
alter table public.orders add column if not exists guest_name text;
alter table public.orders add column if not exists guest_email text;
alter table public.orders alter column user_id drop not null;
do $c$ begin
  alter table public.orders add constraint order_owner_present check (
    (user_id is not null and guest_email is null and guest_name is null)
    or (user_id is null and guest_email is not null and guest_name is not null));
exception when duplicate_object then null; end $c$;
do $c$ begin
  alter table public.orders add constraint guest_fields_sane check (
    (guest_email is null or (char_length(guest_email) <= 254 and guest_email = lower(guest_email) and guest_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'))
    and (guest_name is null or char_length(guest_name) between 1 and 80));
exception when duplicate_object then null; end $c$;
create unique index if not exists orders_guest_idempotency_idx on public.orders (guest_email, idempotency_key) where user_id is null;
create index if not exists orders_branch_slot_idx on public.orders (branch_slug, pickup_slot) where fulfilment_status <> 'cancelled';

create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
revoke all on table public.app_settings from anon, authenticated;
insert into public.app_settings (key, value) values ('payments_mode', 'test'), ('claim_days', '90') on conflict (key) do nothing;

create table if not exists public.points_claims (
  id bigint generated always as identity primary key,
  order_id uuid not null unique references public.orders(id) on delete restrict,
  guest_email text not null,
  points integer not null check (points > 0),
  status text not null default 'pending' check (status in ('pending','claimed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  claimed_by uuid references public.profiles(id) on delete restrict,
  claimed_at timestamptz,
  constraint claim_state_consistent check ((status = 'claimed') = (claimed_by is not null and claimed_at is not null))
);
create index if not exists points_claims_email_idx on public.points_claims (guest_email) where status = 'pending';
alter table public.points_claims enable row level security;
revoke all on table public.points_claims from anon, authenticated;

-- ---------- place_order ----------
-- Signed-in member: p_guest_name / p_guest_email must be null. Guest (no session): both required.
-- p_items: [{"menu_item_id":"<uuid>","quantity":1..20}] (1..30 lines; duplicates merged).
-- p_pickup_at: null = as soon as possible; otherwise must be on the 15-minute grid.
-- Stable error codes: invalid_items, invalid_guest, note_too_long, branch_closed_or_unknown, item_unavailable,
-- invalid_pickup_time, too_soon, closed, slot_full, idempotency_conflict, no_profile, rate_limited
drop function if exists public.place_order(text, jsonb, timestamptz, text, text);
create or replace function public.place_order(
  p_branch text, p_items jsonb, p_pickup_at timestamptz, p_note text, p_idempotency_key text,
  p_guest_name text default null, p_guest_email text default null)
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
  v_count integer;
  v_lines jsonb;
  v_subtotal integer := 0; v_tax integer; v_order_id uuid;
  v_note text := nullif(pg_catalog.btrim(coalesce(p_note, '')), '');
  r record;
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
    p_branch || '|' || v_lines::text || '|' || coalesce(p_pickup_at::text, 'asap') || '|' || coalesce(v_note, '') || '|' || coalesce(v_gname, ''), 'UTF8')), 'hex');

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
      'subtotal_cents', v_existing.subtotal_cents, 'tax_cents', v_existing.tax_cents, 'total_cents', v_existing.total_cents,
      'status', v_existing.fulfilment_status, 'payment_status', v_existing.payment_status, 'replayed', true);
  end if;

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
  v_local := v_ready at time zone v_branch.timezone;
  select * into v_hours from public.branch_hours where branch_slug = p_branch and weekday = pg_catalog.date_part('dow', v_local)::smallint;
  if not found or v_hours.closed then raise exception 'closed'; end if;
  v_open  := (v_local::date + v_hours.opens_local) at time zone v_branch.timezone;
  v_close := (v_local::date + v_hours.closes_local) at time zone v_branch.timezone;
  if v_close <= v_open then v_close := v_close + interval '1 day'; end if;   -- overnight hours
  v_first := v_open + c_prep;
  v_last := v_close - c_last_before_close;
  if p_pickup_at is null and v_ready < v_first then v_ready := v_first; end if;
  if v_ready < v_first or v_ready > v_last then raise exception 'closed'; end if;
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
  v_tax := (v_subtotal * v_branch.tax_rate_bps + 5000) / 10000;   -- half-up to the cent

  insert into public.orders (branch_slug, user_id, guest_name, guest_email, idempotency_key, request_hash, scheduled_for, pickup_slot,
    subtotal_cents, tax_rate_bps, tax_cents, total_cents, customer_note)
  values (p_branch, v_uid, v_gname, v_gemail, p_idempotency_key, v_hash, v_ready, v_slot,
    v_subtotal, v_branch.tax_rate_bps, v_tax, v_subtotal + v_tax, v_note)
  returning id into v_order_id;

  insert into public.order_items (order_id, menu_item_id, item_name_en_snapshot, item_name_fr_snapshot, quantity, unit_price_cents, line_total_cents)
  select v_order_id, mi.id, mi.name_en, mi.name_fr, (l->>'q')::integer, bmi.price_cents, (l->>'q')::integer * bmi.price_cents
  from pg_catalog.jsonb_array_elements(v_lines) l
  join public.branch_menu_items bmi on bmi.branch_slug = p_branch and bmi.menu_item_id = (l->>'id')::uuid
  join public.menu_items mi on mi.id = bmi.menu_item_id;

  insert into public.order_events (order_id, actor_user_id, event_type, to_status, details)
  values (v_order_id, v_uid, 'placed', 'placed', pg_catalog.jsonb_build_object('pickup_at', v_ready, 'slot', v_slot, 'asap', p_pickup_at is null, 'guest', v_uid is null));

  return pg_catalog.jsonb_build_object('order_id', v_order_id, 'pickup_at', v_ready, 'slot', v_slot, 'subtotal_cents', v_subtotal,
    'tax_cents', v_tax, 'total_cents', v_subtotal + v_tax, 'status', 'placed', 'payment_status', 'unpaid', 'replayed', false);
end;
$azal_place_order$;

-- ---------- pay_order_test (TEST MODE) ----------
-- Members pay their own order; guests pay theirs by giving the order's email.
-- Tokens: tok_test_ok -> paid; tok_test_declined / tok_test_insufficient -> declined (order stays unpaid).
drop function if exists public.pay_order_test(uuid, text);
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

  insert into public.payment_events (order_id, provider, provider_event_id, event_type, amount_cents)
  values (p_order, 'azal-test', 'test_' || pg_catalog.gen_random_uuid(), case when v_outcome = 'paid' then 'payment_succeeded' else 'payment_failed' end,
          case when v_outcome = 'paid' then v_o.total_cents else 0 end);
  if v_outcome = 'paid' then
    update public.orders set payment_status = 'paid', updated_at = pg_catalog.now() where id = p_order;
    insert into public.order_events (order_id, actor_user_id, event_type, from_status, to_status, details)
    values (p_order, v_uid, 'paid', 'unpaid', 'paid', pg_catalog.jsonb_build_object('provider', 'azal-test'));
  end if;
  return pg_catalog.jsonb_build_object('order_id', p_order, 'outcome', v_outcome,
    'reason', case p_token when 'tok_test_insufficient' then 'insufficient_funds' when 'tok_test_declined' then 'card_declined' end,
    'total_cents', v_o.total_cents);
end;
$azal_pay_order_test$;

-- ---------- staff_update_order ----------
-- accept | prepare | ready | hand_over | cancel. Unpaid orders cannot be worked on. Cancelling a paid order
-- records a test refund (test mode only). On paid + handed over: member -> one earn row; guest -> one pending claim.
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
  end if;

  update public.orders set fulfilment_status = v_to, updated_at = pg_catalog.now(),
    handed_over_at = case when v_to = 'handed_over' then pg_catalog.now() else handed_over_at end
   where id = p_order;
  insert into public.order_events (order_id, actor_user_id, event_type, from_status, to_status)
  values (p_order, auth.uid(), p_action, v_from, v_to);

  select * into v_o from public.orders where id = p_order;
  if v_o.payment_status = 'paid' and v_o.fulfilment_status = 'handed_over' then
    v_points := (v_o.subtotal_cents * 10) / 100;   -- 10 pts per $1, floored
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

-- ---------- guest claims ----------
-- my_pending_claims(): a signed-in member sees points waiting for their (verified) email.
create or replace function public.my_pending_claims()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $azal_my_pending_claims$
  select pg_catalog.jsonb_build_object('points', coalesce(pg_catalog.sum(points), 0), 'claims', pg_catalog.count(*))
  from public.points_claims
  where status = 'pending' and expires_at > pg_catalog.now()
    and auth.uid() is not null and guest_email = pg_catalog.lower(coalesce(auth.email(), ''));
$azal_my_pending_claims$;

-- claim_guest_points(): moves every pending, unexpired claim for the caller's verified email into their ledger,
-- exactly once (row locks + the per-order unique earn index). Returns the number of points added.
create or replace function public.claim_guest_points()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $azal_claim_guest_points$
declare
  v_uid uuid := auth.uid();
  v_email text := pg_catalog.lower(coalesce(auth.email(), ''));
  v_total integer := 0;
  c record;
begin
  if v_uid is null or v_email = '' then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from public.profiles where id = v_uid) then raise exception 'no_profile'; end if;
  for c in select * from public.points_claims
           where status = 'pending' and expires_at > pg_catalog.now() and guest_email = v_email
           order by id for update
  loop
    insert into public.points_ledger (user_id, order_id, event_key, entry_type, delta_points, reason)
    values (v_uid, c.order_id, 'earn:' || c.order_id, 'earn', c.points, 'Guest order ' || c.order_id || ' claimed')
    on conflict do nothing;
    if found then v_total := v_total + c.points; end if;
    update public.points_claims set status = 'claimed', claimed_by = v_uid, claimed_at = pg_catalog.now() where id = c.id;
  end loop;
  return pg_catalog.jsonb_build_object('points_added', v_total);
end;
$azal_claim_guest_points$;

-- ---------- grants ----------
revoke all on function public.place_order(text, jsonb, timestamptz, text, text, text, text) from public;
revoke all on function public.pay_order_test(uuid, text, text) from public;
revoke all on function public.staff_update_order(uuid, text) from public, anon;
revoke all on function public.my_pending_claims() from public, anon;
revoke all on function public.claim_guest_points() from public, anon;
-- Guests have no session, so ordering and test payment are open to anon (both functions validate inside).
grant execute on function public.place_order(text, jsonb, timestamptz, text, text, text, text) to anon, authenticated;
grant execute on function public.pay_order_test(uuid, text, text) to anon, authenticated;
grant execute on function public.staff_update_order(uuid, text) to authenticated;
grant execute on function public.my_pending_claims() to authenticated;
grant execute on function public.claim_guest_points() to authenticated;
revoke insert, update, delete, truncate on table public.orders from anon, authenticated;

commit;
