-- AZAL P2 staging foundation — NOT FOR PRODUCTION
-- Draft only. Apply only to an owner-created, isolated Supabase STAGING project
-- after Muse review and after the owner confirms project configuration.
-- No Auth users, real menu, hours, prices, payment provider, or reward policy are seeded.
-- Monetary values are integer CAD cents. All timestamps are timestamptz.

begin;

create extension if not exists pgcrypto;

create table if not exists public.branches (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  name_en text not null,
  name_fr text not null,
  city text not null,
  timezone text not null default 'America/Toronto',
  tax_rate_bps integer not null check (tax_rate_bps between 0 and 3000),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key,
  display_name text,
  created_at timestamptz not null default now(),
  anonymized_at timestamptz,
  constraint profile_name_length check (display_name is null or char_length(display_name) <= 80)
);

create table if not exists public.user_roles (
  user_id uuid not null references public.profiles(id) on delete restrict,
  role text not null check (role in ('customer','staff','admin')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table if not exists public.staff_branch_access (
  user_id uuid not null references public.profiles(id) on delete restrict,
  branch_slug text not null references public.branches(slug) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (user_id, branch_slug)
);

create table if not exists public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_en text not null,
  name_fr text not null,
  sort_order integer not null default 0,
  active boolean not null default true
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.menu_categories(id) on delete restrict,
  slug text not null unique,
  name_en text not null,
  name_fr text not null,
  description_en text not null default '',
  description_fr text not null default '',
  image_url text,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menu_name_en_nonempty check (char_length(trim(name_en)) > 0),
  constraint menu_name_fr_nonempty check (char_length(trim(name_fr)) > 0)
);

create table if not exists public.branch_menu_items (
  branch_slug text not null references public.branches(slug) on delete restrict,
  menu_item_id uuid not null references public.menu_items(id) on delete restrict,
  price_cents integer not null check (price_cents >= 0),
  currency char(3) not null default 'CAD' check (currency = 'CAD'),
  available boolean not null default false,
  sort_order integer not null default 0,
  primary key (branch_slug, menu_item_id)
);

create table if not exists public.menu_item_option_groups (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references public.menu_items(id) on delete restrict,
  name_en text not null,
  name_fr text not null,
  required boolean not null default false,
  min_select integer not null default 0 check (min_select >= 0),
  max_select integer not null default 1 check (max_select >= min_select),
  sort_order integer not null default 0
);

create table if not exists public.menu_item_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.menu_item_option_groups(id) on delete restrict,
  name_en text not null,
  name_fr text not null,
  active boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists public.branch_option_prices (
  branch_slug text not null references public.branches(slug) on delete restrict,
  option_id uuid not null references public.menu_item_options(id) on delete restrict,
  price_delta_cents integer not null default 0,
  primary key (branch_slug, option_id)
);

create table if not exists public.branch_hours (
  branch_slug text not null references public.branches(slug) on delete restrict,
  weekday smallint not null check (weekday between 0 and 6),
  opens_local time,
  closes_local time,
  closed boolean not null default true,
  primary key (branch_slug, weekday),
  constraint hours_consistent check (
    (closed and opens_local is null and closes_local is null)
    or
    (not closed and opens_local is not null and closes_local is not null and opens_local <> closes_local)
  )
);

create table if not exists public.memberships (
  user_id uuid primary key references public.profiles(id) on delete restrict,
  status text not null default 'active' check (status in ('active','suspended')),
  joined_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  branch_slug text not null references public.branches(slug) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  idempotency_key text not null check (char_length(idempotency_key) between 16 and 128),
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  fulfilment_type text not null default 'pickup' check (fulfilment_type = 'pickup'),
  fulfilment_status text not null default 'placed'
    check (fulfilment_status in ('placed','accepted','preparing','ready','handed_over','cancelled')),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid','paid','refunded','voided')),
  scheduled_for timestamptz,
  currency char(3) not null default 'CAD' check (currency = 'CAD'),
  subtotal_cents integer not null check (subtotal_cents >= 0),
  tax_rate_bps integer not null check (tax_rate_bps between 0 and 3000),
  tax_cents integer not null check (tax_cents >= 0),
  total_cents integer not null check (total_cents = subtotal_cents + tax_cents),
  customer_note text check (customer_note is null or char_length(customer_note) <= 500),
  placed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  handed_over_at timestamptz,
  constraint order_idempotency unique (user_id, idempotency_key),
  constraint handed_over_state_consistent check (
    (fulfilment_status = 'handed_over' and handed_over_at is not null)
    or (fulfilment_status <> 'handed_over' and handed_over_at is null)
  )
);

create index if not exists orders_branch_status_placed_idx
  on public.orders (branch_slug, fulfilment_status, placed_at desc, id desc);
create index if not exists orders_user_placed_idx
  on public.orders (user_id, placed_at desc, id desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  item_name_en_snapshot text not null,
  item_name_fr_snapshot text not null,
  quantity integer not null check (quantity between 1 and 50),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  line_total_cents integer not null check (line_total_cents = quantity * unit_price_cents)
);

create table if not exists public.order_item_options (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  option_name_en_snapshot text not null,
  option_name_fr_snapshot text not null,
  quantity integer not null default 1 check (quantity between 1 and 20),
  unit_delta_cents integer not null,
  line_delta_cents integer not null check (line_delta_cents = quantity * unit_delta_cents)
);

create table if not exists public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete restrict,
  actor_user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  from_status text,
  to_status text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists order_events_order_created_idx
  on public.order_events (order_id, created_at, id);

create table if not exists public.points_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete restrict,
  order_id uuid references public.orders(id) on delete restrict,
  event_key text not null unique,
  entry_type text not null check (entry_type in ('earn','redeem','earn_reversal','redeem_refund')),
  delta_points integer not null check (delta_points <> 0),
  reason text not null,
  created_at timestamptz not null default now(),
  constraint points_event_sign check (
    (entry_type in ('earn','redeem_refund') and delta_points > 0)
    or (entry_type in ('redeem','earn_reversal') and delta_points < 0)
  )
);
create index if not exists points_ledger_user_created_idx
  on public.points_ledger (user_id, created_at desc, id desc);

-- Exactly-once ledger invariants from the Yemen Gate v5.4 contract:
-- one earn, one earn reversal, and one redemption refund per source order.
-- event_key remains the global idempotency key for all ledger event types.
create unique index if not exists points_ledger_one_earn_per_order_idx
  on public.points_ledger (order_id)
  where order_id is not null and entry_type = 'earn';
create unique index if not exists points_ledger_one_earn_reversal_per_order_idx
  on public.points_ledger (order_id)
  where order_id is not null and entry_type = 'earn_reversal';
create unique index if not exists points_ledger_one_redeem_refund_per_order_idx
  on public.points_ledger (order_id)
  where order_id is not null and entry_type = 'redeem_refund';

create table if not exists public.payment_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  amount_cents integer not null check (amount_cents >= 0),
  currency char(3) not null default 'CAD' check (currency = 'CAD'),
  received_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create table if not exists public.settlement_batches (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_batch_id text not null,
  currency char(3) not null default 'CAD' check (currency = 'CAD'),
  gross_cents integer not null,
  fees_cents integer not null default 0,
  net_cents integer not null,
  received_at timestamptz not null default now(),
  unique (provider, external_batch_id),
  check (net_cents = gross_cents - fees_cents)
);

create table if not exists public.payment_settlements (
  id bigint generated always as identity primary key,
  batch_id uuid not null references public.settlement_batches(id) on delete restrict,
  payment_event_id bigint not null references public.payment_events(id) on delete restrict,
  settled_cents integer not null check (settled_cents >= 0),
  unique (batch_id, payment_event_id)
);

-- Authorization helpers. Fixed search_path and fully-qualified objects are mandatory.
create or replace function public.azal_is_admin()
returns boolean
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = auth.uid() and r.role = 'admin'
  );
$$;

create or replace function public.azal_staff_can_access(p_branch_slug text)
returns boolean
language sql stable security definer
set search_path = pg_catalog, public
as $azal_staff_access$
  select auth.uid() is not null
    and (
      public.azal_is_admin()
      or exists (
        select 1
        from public.user_roles r
        join public.staff_branch_access a on a.user_id = r.user_id
        where r.user_id = auth.uid()
          and r.role = 'staff'
          and a.branch_slug = p_branch_slug
      )
    );
$azal_staff_access$;

-- Create a minimal profile row for every new Auth identity. Do not copy
-- user metadata here: profile display names remain optional and user-controlled.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $azal_handle_new_user$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$azal_handle_new_user$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists azal_handle_new_user_after_insert on auth.users;
create trigger azal_handle_new_user_after_insert
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke all on function public.azal_is_admin() from public, anon;
revoke all on function public.azal_staff_can_access(text) from public, anon;
grant execute on function public.azal_is_admin() to authenticated;
grant execute on function public.azal_staff_can_access(text) to authenticated;

alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.staff_branch_access enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.branch_menu_items enable row level security;
alter table public.menu_item_option_groups enable row level security;
alter table public.menu_item_options enable row level security;
alter table public.branch_option_prices enable row level security;
alter table public.branch_hours enable row level security;
alter table public.memberships enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_options enable row level security;
alter table public.order_events enable row level security;
alter table public.points_ledger enable row level security;
alter table public.payment_events enable row level security;
alter table public.settlement_batches enable row level security;
alter table public.payment_settlements enable row level security;

-- Read-only public catalogue. The site remains demo-only until owner staging gates pass.
create policy branches_public_active on public.branches
  for select to anon, authenticated using (active);
create policy categories_public_active on public.menu_categories
  for select to anon, authenticated using (active);
create policy menu_items_public_active on public.menu_items
  for select to anon, authenticated using (active);
create policy branch_menu_public_available on public.branch_menu_items
  for select to anon, authenticated using (
    available and exists (
      select 1 from public.branches b where b.slug = branch_slug and b.active
    )
  );
create policy option_groups_public on public.menu_item_option_groups
  for select to anon, authenticated using (
    exists (select 1 from public.menu_items m where m.id = menu_item_id and m.active)
  );
create policy options_public_active on public.menu_item_options
  for select to anon, authenticated using (
    active and exists (
      select 1 from public.menu_item_option_groups g
      join public.menu_items m on m.id = g.menu_item_id
      where g.id = group_id and m.active
    )
  );
create policy option_prices_public on public.branch_option_prices
  for select to anon, authenticated using (
    exists (select 1 from public.branches b where b.slug = branch_slug and b.active)
  );

create policy profiles_read_self_or_admin on public.profiles
  for select to authenticated using (id = auth.uid() or public.azal_is_admin());
create policy profiles_update_self_or_admin on public.profiles
  for update to authenticated using (id = auth.uid() or public.azal_is_admin())
  with check (id = auth.uid() or public.azal_is_admin());

create policy roles_read_self_or_admin on public.user_roles
  for select to authenticated using (user_id = auth.uid() or public.azal_is_admin());
create policy staff_access_read_self_or_admin on public.staff_branch_access
  for select to authenticated using (user_id = auth.uid() or public.azal_is_admin());

create policy hours_public_read on public.branch_hours
  for select to anon, authenticated using (
    exists (select 1 from public.branches b where b.slug = branch_slug and b.active)
  );

create policy memberships_read_self_or_admin on public.memberships
  for select to authenticated using (user_id = auth.uid() or public.azal_is_admin());
create policy orders_read_owner_staff on public.orders
  for select to authenticated using (
    user_id = auth.uid() or public.azal_is_admin() or public.azal_staff_can_access(branch_slug)
  );
create policy order_items_read_owner_staff on public.order_items
  for select to authenticated using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and (
        o.user_id = auth.uid() or public.azal_is_admin() or public.azal_staff_can_access(o.branch_slug)
      )
    )
  );
create policy order_item_options_read_owner_staff on public.order_item_options
  for select to authenticated using (
    exists (
      select 1 from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = order_item_id and (
        o.user_id = auth.uid() or public.azal_is_admin() or public.azal_staff_can_access(o.branch_slug)
      )
    )
  );
create policy order_events_read_owner_staff on public.order_events
  for select to authenticated using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and (
        o.user_id = auth.uid() or public.azal_is_admin() or public.azal_staff_can_access(o.branch_slug)
      )
    )
  );
create policy points_read_self_or_admin on public.points_ledger
  for select to authenticated using (user_id = auth.uid() or public.azal_is_admin());

-- Explicit least-privilege grants complement RLS; do not rely on project defaults.
revoke all on table
  public.branches, public.profiles, public.user_roles, public.staff_branch_access,
  public.menu_categories, public.menu_items, public.branch_menu_items,
  public.menu_item_option_groups, public.menu_item_options, public.branch_option_prices,
  public.branch_hours, public.memberships, public.orders, public.order_items,
  public.order_item_options, public.order_events, public.points_ledger,
  public.payment_events, public.settlement_batches, public.payment_settlements
from anon, authenticated;

grant select on
  public.branches, public.menu_categories, public.menu_items, public.branch_menu_items,
  public.menu_item_option_groups, public.menu_item_options, public.branch_option_prices,
  public.branch_hours
to anon, authenticated;

grant select on
  public.profiles, public.user_roles, public.staff_branch_access, public.memberships,
  public.orders, public.order_items, public.order_item_options, public.order_events,
  public.points_ledger
to authenticated;

-- Customers can edit only their display name; role, identity and anonymization
-- fields remain server/owner-controlled.
grant update (display_name) on public.profiles to authenticated;

-- Payment and settlement tables have no client policies: server-only, disabled in P2.
-- No INSERT/UPDATE/DELETE policies exist for orders, snapshots, roles, ledger or payment audit.

-- Only non-sensitive branch planning metadata is seeded. No address or opening hours.
insert into public.branches (slug, name_en, name_fr, city, timezone, tax_rate_bps, active)
values ('ottawa', 'AZAL Ottawa (concept)', 'AZAL Ottawa (concept)', 'Ottawa', 'America/Toronto', 1300, true)
on conflict (slug) do nothing;

commit;
