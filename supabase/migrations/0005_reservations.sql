-- AZAL 0005: table reservations (Claude). Apply after 0001-0004. Idempotent: safe to run twice.
-- Owner rule (07:48 via Muse, binding): a reservation reserves a TABLE only. Fields, and only these:
-- guest name, mobile phone, email (confirmation goes there), number of people, date + time chosen by the guest.
-- No dishes, cart, notes, payment, deposit, and no link to any food order.
-- Adopted config: 50 seats, 60-min dwell, 30-min slots, party 1-10 online, no deposit, hours from branch_hours.
-- Email is sent OUTSIDE SQL: reserve_table writes two outbox rows (guest confirmation + restaurant notice to
-- reservation_settings.notify_email). A sender (Edge Function / webhook with the owner's SMTP key, Tier C) reads
-- the outbox with the service role; a failed send never undoes a booking.
-- Hardening: SECURITY DEFINER functions use search_path = '' and schema-qualified names; no client table DML.
begin;

do $azal_0005_preflight$
begin
  if to_regclass('public.branch_hours') is null or to_regprocedure('public.azal_staff_can_access(text)') is null
     or to_regclass('public.app_settings') is null then
    raise exception '0005 requires 0001 + 0002 + 0003 + 0004';
  end if;
end;
$azal_0005_preflight$;

-- ---------- tables ----------
create table if not exists public.reservation_settings (
  branch_slug text primary key references public.branches(slug) on delete restrict,
  seats integer not null default 50 check (seats between 1 and 500),
  dwell_minutes integer not null default 60 check (dwell_minutes between 15 and 240),
  step_minutes integer not null default 30 check (step_minutes in (15, 30, 60)),
  max_party integer not null default 10 check (max_party between 1 and 50),
  min_lead_minutes integer not null default 60 check (min_lead_minutes between 0 and 1440),
  window_days integer not null default 30 check (window_days between 1 and 365),
  notify_email text check (notify_email is null or notify_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  updated_at timestamptz not null default now()
);

create table if not exists public.reservation_closures (
  branch_slug text not null references public.branches(slug) on delete restrict,
  closed_on date not null,
  reason text check (reason is null or char_length(reason) <= 200),
  primary key (branch_slug, closed_on)
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  branch_slug text not null references public.branches(slug) on delete restrict,
  guest_name text not null check (char_length(guest_name) between 1 and 80),
  guest_email text not null check (char_length(guest_email) <= 254 and guest_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  guest_phone text not null check (guest_phone ~ '^\+[1-9][0-9]{9,14}$'),
  party_size integer not null check (party_size between 1 and 50),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('confirmed','seated','completed','cancelled','no_show')),
  code text not null unique check (code ~ '^[A-HJ-KM-NP-Z2-9]{8}$'),
  idempotency_key text not null check (char_length(idempotency_key) between 16 and 128),
  request_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reservation_window check (ends_at > starts_at),
  constraint reservation_idem unique (guest_email, idempotency_key)
);
create index if not exists reservations_branch_time_idx on public.reservations (branch_slug, starts_at) where status in ('confirmed','seated');

create table if not exists public.reservation_events (
  id bigint generated always as identity primary key,
  reservation_id uuid not null references public.reservations(id) on delete restrict,
  from_status text,
  to_status text not null,
  actor uuid,
  at timestamptz not null default now()
);

create table if not exists public.reservation_outbox (
  id bigint generated always as identity primary key,
  reservation_id uuid not null references public.reservations(id) on delete restrict,
  kind text not null check (kind in ('guest_confirmation','restaurant_notice','guest_cancellation')),
  to_email text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  attempts integer not null default 0,
  last_error text
);
create index if not exists reservation_outbox_unsent_idx on public.reservation_outbox (created_at) where sent_at is null;

alter table public.reservation_settings enable row level security;
alter table public.reservation_closures enable row level security;
alter table public.reservations enable row level security;
alter table public.reservation_events enable row level security;
alter table public.reservation_outbox enable row level security;
revoke all on public.reservation_settings, public.reservation_closures, public.reservations,
  public.reservation_events, public.reservation_outbox from public, anon, authenticated;

-- Staff of the branch (or admin) may read bookings for the host stand; nobody else reads rows.
grant select on public.reservations to authenticated;
drop policy if exists reservations_read_staff on public.reservations;
create policy reservations_read_staff on public.reservations
  for select to authenticated using (public.azal_staff_can_access(branch_slug));

insert into public.reservation_settings (branch_slug, notify_email)
select slug, 'info@azalrestaurant.com' from public.branches where slug = 'ottawa'
on conflict (branch_slug) do nothing;

-- ---------- helpers ----------
create or replace function public.azal_reservation_phone(p_phone text)
returns text language sql immutable set search_path = '' as $$
  select case
    when d ~ '^[0-9]{10}$' then '+1' || d
    when d ~ '^1[0-9]{10}$' then '+' || d
    when p_phone ~ '^\s*\+' and d ~ '^[1-9][0-9]{9,14}$' then '+' || d
  end
  from (select pg_catalog.regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') as d) x;
$$;

-- Seats taken at every slot tick of [p_start, p_start + dwell) must leave room for p_party.
create or replace function public.azal_reservation_fits(p_branch text, p_start timestamptz, p_party integer)
returns boolean language plpgsql stable set search_path = '' as $$
declare v_s public.reservation_settings; v_t timestamptz; v_taken integer;
begin
  select * into v_s from public.reservation_settings where branch_slug = p_branch;
  v_t := p_start;
  while v_t < p_start + pg_catalog.make_interval(mins => v_s.dwell_minutes) loop
    select coalesce(sum(party_size), 0) into v_taken from public.reservations
      where branch_slug = p_branch and status in ('confirmed','seated') and starts_at <= v_t and ends_at > v_t;
    if v_taken + p_party > v_s.seats then return false; end if;
    v_t := v_t + pg_catalog.make_interval(mins => v_s.step_minutes);
  end loop;
  return true;
end;
$$;

-- Bookable start times for one local day: on the step grid, inside opening hours with the whole dwell before close,
-- after the lead time, inside the window, not a closure. Seats left = the minimum over the dwell ticks.
create or replace function public.reservation_availability(p_branch text, p_day date, p_party integer default 2)
returns table (starts_at timestamptz, seats_left integer)
language plpgsql stable security definer set search_path = '' as $$
declare v_s public.reservation_settings; v_b public.branches; v_h public.branch_hours; v_open timestamptz; v_close timestamptz; v_t timestamptz; v_u timestamptz; v_min integer; v_taken integer;
begin
  select * into v_s from public.reservation_settings where branch_slug = p_branch;
  select * into v_b from public.branches where slug = p_branch;
  if v_s.branch_slug is null or v_b.slug is null or p_day is null or p_party is null or p_party < 1 or p_party > v_s.max_party then return; end if;
  if exists (select 1 from public.reservation_closures c where c.branch_slug = p_branch and c.closed_on = p_day) then return; end if;
  select * into v_h from public.branch_hours h where h.branch_slug = p_branch and h.weekday = pg_catalog.date_part('dow', p_day)::smallint;
  if v_h.branch_slug is null or v_h.closed or v_h.closes_local <= v_h.opens_local then return; end if;
  v_open := (p_day + v_h.opens_local) at time zone v_b.timezone;
  v_close := (p_day + v_h.closes_local) at time zone v_b.timezone;
  v_t := v_open;
  while v_t + pg_catalog.make_interval(mins => v_s.dwell_minutes) <= v_close loop
    if v_t >= now() + pg_catalog.make_interval(mins => v_s.min_lead_minutes) and v_t <= now() + pg_catalog.make_interval(days => v_s.window_days) then
      v_min := v_s.seats; v_u := v_t;
      while v_u < v_t + pg_catalog.make_interval(mins => v_s.dwell_minutes) loop
        select coalesce(sum(r.party_size), 0) into v_taken from public.reservations r
          where r.branch_slug = p_branch and r.status in ('confirmed','seated') and r.starts_at <= v_u and r.ends_at > v_u;
        v_min := least(v_min, v_s.seats - v_taken);
        v_u := v_u + pg_catalog.make_interval(mins => v_s.step_minutes);
      end loop;
      if v_min >= p_party then starts_at := v_t; seats_left := v_min; return next; end if;
    end if;
    v_t := v_t + pg_catalog.make_interval(mins => v_s.step_minutes);
  end loop;
end;
$$;

create or replace function public.reserve_table(p_branch text, p_starts_at timestamptz, p_party integer, p_name text,
  p_email text, p_phone text, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_s public.reservation_settings; v_b public.branches; v_h public.branch_hours; v_day date; v_local timestamp;
  v_name text := pg_catalog.btrim(coalesce(p_name, '')); v_email text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, '')));
  v_phone text := public.azal_reservation_phone(p_phone); v_hash text; v_r public.reservations; v_code text; v_i integer; v_bytes bytea;
  v_alpha constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  if p_branch is null or p_starts_at is null or p_party is null or p_idempotency_key is null
     or char_length(p_idempotency_key) not between 16 and 128 then raise exception 'invalid'; end if;
  if char_length(v_name) not between 1 and 80 then raise exception 'invalid_name'; end if;
  if char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if v_phone is null then raise exception 'invalid_phone'; end if;
  select * into v_s from public.reservation_settings where branch_slug = p_branch;
  select * into v_b from public.branches where slug = p_branch;
  if v_s.branch_slug is null or v_b.slug is null then raise exception 'invalid'; end if;
  if p_party < 1 then raise exception 'invalid'; end if;
  if p_party > v_s.max_party then raise exception 'party_too_large'; end if;

  -- Idempotency: same email + key returns the same booking; a different request under the same key is refused.
  v_hash := pg_catalog.md5(pg_catalog.concat_ws('|', p_branch, p_starts_at::text, p_party::text, v_name, v_email, v_phone));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('resv-key|' || v_email || '|' || p_idempotency_key));
  select * into v_r from public.reservations where guest_email = v_email and idempotency_key = p_idempotency_key;
  if v_r.id is not null then
    if v_r.request_hash <> v_hash then raise exception 'idempotency_conflict'; end if;
    return pg_catalog.jsonb_build_object('reservation_id', v_r.id, 'code', v_r.code, 'starts_at', v_r.starts_at, 'party_size', v_r.party_size, 'status', v_r.status, 'replayed', true);
  end if;

  if (select count(*) from public.reservations where guest_email = v_email and created_at > now() - interval '10 minutes') >= 5
  then raise exception 'rate_limited'; end if;

  -- Time rules, judged in the branch time zone.
  v_local := p_starts_at at time zone v_b.timezone;
  v_day := v_local::date;
  if (pg_catalog.date_part('minute', v_local)::integer % v_s.step_minutes) <> 0 or pg_catalog.date_part('second', v_local) <> 0 then raise exception 'invalid_time'; end if;
  if p_starts_at < now() + pg_catalog.make_interval(mins => v_s.min_lead_minutes) then raise exception 'too_soon'; end if;
  if p_starts_at > now() + pg_catalog.make_interval(days => v_s.window_days) then raise exception 'too_far'; end if;
  if exists (select 1 from public.reservation_closures c where c.branch_slug = p_branch and c.closed_on = v_day) then raise exception 'closed'; end if;
  select * into v_h from public.branch_hours h where h.branch_slug = p_branch and h.weekday = pg_catalog.date_part('dow', v_day)::smallint;
  if v_h.branch_slug is null or v_h.closed or v_h.closes_local <= v_h.opens_local
     or v_local::time < v_h.opens_local or (v_local + pg_catalog.make_interval(mins => v_s.dwell_minutes))::time > v_h.closes_local
     or (v_local + pg_catalog.make_interval(mins => v_s.dwell_minutes))::date <> v_day then raise exception 'closed'; end if;

  -- Capacity under a per-branch-day lock, checked at every tick of the stay.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('resv-day|' || p_branch || '|' || v_day::text));
  if not public.azal_reservation_fits(p_branch, p_starts_at, p_party) then raise exception 'slot_full'; end if;

  loop
    v_bytes := pg_catalog.decode(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 'hex');
    v_code := '';
    for v_i in 0..7 loop v_code := v_code || pg_catalog.substr(v_alpha, (pg_catalog.get_byte(v_bytes, v_i) % 31) + 1, 1); end loop;
    exit when not exists (select 1 from public.reservations where code = v_code);
  end loop;

  insert into public.reservations (branch_slug, guest_name, guest_email, guest_phone, party_size, starts_at, ends_at, code, idempotency_key, request_hash)
  values (p_branch, v_name, v_email, v_phone, p_party, p_starts_at, p_starts_at + pg_catalog.make_interval(mins => v_s.dwell_minutes), v_code, p_idempotency_key, v_hash)
  returning * into v_r;
  insert into public.reservation_events (reservation_id, from_status, to_status, actor) values (v_r.id, null, 'confirmed', auth.uid());
  insert into public.reservation_outbox (reservation_id, kind, to_email) values (v_r.id, 'guest_confirmation', v_email);
  if v_s.notify_email is not null then
    insert into public.reservation_outbox (reservation_id, kind, to_email) values (v_r.id, 'restaurant_notice', v_s.notify_email);
  end if;
  return pg_catalog.jsonb_build_object('reservation_id', v_r.id, 'code', v_r.code, 'starts_at', v_r.starts_at, 'party_size', v_r.party_size, 'status', v_r.status, 'replayed', false);
end;
$$;

-- Guests cancel with code + email (no account). Only before the start time.
create or replace function public.cancel_reservation(p_code text, p_email text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_r public.reservations;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('resv-cancel|' || pg_catalog.lower(coalesce(p_email, ''))));
  select * into v_r from public.reservations where code = pg_catalog.upper(pg_catalog.btrim(coalesce(p_code, '')))
    and guest_email = pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, ''))) for update;
  if v_r.id is null then raise exception 'not_found'; end if;  -- same error for wrong code or wrong email
  if v_r.status = 'cancelled' then return pg_catalog.jsonb_build_object('code', v_r.code, 'status', 'cancelled', 'replayed', true); end if;
  if v_r.status <> 'confirmed' or v_r.starts_at <= now() then raise exception 'too_late'; end if;
  update public.reservations set status = 'cancelled', updated_at = now() where id = v_r.id;
  insert into public.reservation_events (reservation_id, from_status, to_status, actor) values (v_r.id, 'confirmed', 'cancelled', auth.uid());
  insert into public.reservation_outbox (reservation_id, kind, to_email) values (v_r.id, 'guest_cancellation', v_r.guest_email);
  return pg_catalog.jsonb_build_object('code', v_r.code, 'status', 'cancelled', 'replayed', false);
end;
$$;

-- Host stand: staff of the branch move a booking on. no_show only from 15 minutes after the start.
create or replace function public.staff_set_reservation_status(p_reservation uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_r public.reservations; v_ok boolean;
begin
  select * into v_r from public.reservations where id = p_reservation for update;
  if v_r.id is null or not public.azal_staff_can_access(v_r.branch_slug) then raise exception 'not_found'; end if;
  v_ok := case
    when v_r.status = 'confirmed' and p_status in ('seated','cancelled') then true
    when v_r.status = 'confirmed' and p_status = 'no_show' then now() >= v_r.starts_at + interval '15 minutes'
    when v_r.status = 'seated' and p_status = 'completed' then true
    else false end;
  if not v_ok then raise exception 'bad_transition'; end if;
  update public.reservations set status = p_status, updated_at = now() where id = v_r.id;
  insert into public.reservation_events (reservation_id, from_status, to_status, actor) values (v_r.id, v_r.status, p_status, auth.uid());
  if p_status = 'cancelled' then
    insert into public.reservation_outbox (reservation_id, kind, to_email) values (v_r.id, 'guest_cancellation', v_r.guest_email);
  end if;
  return pg_catalog.jsonb_build_object('reservation_id', v_r.id, 'status', p_status);
end;
$$;

-- ---------- grants ----------
revoke all on function public.azal_reservation_phone(text) from public, anon, authenticated;
revoke all on function public.azal_reservation_fits(text, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.reservation_availability(text, date, integer) from public;
revoke all on function public.reserve_table(text, timestamptz, integer, text, text, text, text) from public;
revoke all on function public.cancel_reservation(text, text) from public;
revoke all on function public.staff_set_reservation_status(uuid, text) from public, anon;
grant execute on function public.reservation_availability(text, date, integer) to anon, authenticated;
grant execute on function public.reserve_table(text, timestamptz, integer, text, text, text, text) to anon, authenticated;
grant execute on function public.cancel_reservation(text, text) to anon, authenticated;
grant execute on function public.staff_set_reservation_status(uuid, text) to authenticated;

commit;
