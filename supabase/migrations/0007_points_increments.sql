-- AZAL 0007: forward-only rewards correction. Keep 0006 immutable.
-- Binding rule: 10,000 points = $10; 20,000 = $20; 30,000 = $30; etc. 5,000 = $5 is invalid.
-- Apply only after 0006 in the approved staging sequence. This does not approve tax/accounting or live payments.
begin;

do $preflight$
begin
  if to_regclass('public.app_settings') is null
     or to_regclass('public.orders') is null
     or to_regclass('public.points_ledger') is null
     or to_regprocedure('public.azal_redeem_cents(integer)') is null
     or to_regprocedure('public.redeem_options()') is null
     or to_regprocedure('public.place_order(text,jsonb,timestamp with time zone,text,text,text,text,integer)') is null
     or to_regprocedure('public.pay_order_test(uuid,text,text)') is null then
    raise exception '0007 requires 0006 and the complete ordering schema';
  end if;
end;
$preflight$;

-- Replace the legacy exact-tier seed. 0006 remains historical and is never edited.
update public.app_settings
set value = '10000:1000', updated_at = pg_catalog.now()
where key = 'redeem_tiers';
insert into public.app_settings (key, value)
select 'redeem_tiers', '10000:1000'
where not exists (select 1 from public.app_settings where key = 'redeem_tiers');

-- The configuration is a policy constant, not an arbitrary tier list.
create or replace function public.azal_guard_redeem_tiers_setting()
returns trigger
language plpgsql
set search_path = ''
as $guard$
begin
  if new.key = 'redeem_tiers' and new.value <> '10000:1000' then
    raise exception 'invalid_redeem_config';
  end if;
  return new;
end;
$guard$;
revoke all on function public.azal_guard_redeem_tiers_setting() from public, anon, authenticated;
drop trigger if exists app_settings_guard_redeem_tiers on public.app_settings;
create trigger app_settings_guard_redeem_tiers
before insert or update of key, value on public.app_settings
for each row execute function public.azal_guard_redeem_tiers_setting();

-- Compatibility helper returns the one policy step only. It never materializes an unbounded ladder.
create or replace function public.azal_redeem_tiers()
returns table(points integer, cents integer)
language sql
stable
security definer
set search_path = ''
as $tiers$
  select 10000::integer, 1000::integer
  where exists (
    select 1 from public.app_settings
    where key = 'redeem_tiers' and value = '10000:1000'
  )
$tiers$;

-- Server authority: positive multiples of 10,000 points only; $0.001 per point = points / 10 cents.
create or replace function public.azal_redeem_cents(p_points integer)
returns integer
language sql
stable
security definer
set search_path = ''
as $redeem$
  select case
    when p_points is not null
      and p_points > 0
      and p_points % 10000 = 0
      and exists (select 1 from public.azal_redeem_tiers())
    then p_points / 10
    else null
  end
$redeem$;

-- Compact descriptor only. The browser derives a bounded set using this order's subtotal and member balance.
create or replace function public.redeem_options()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $options$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'signed_out'; end if;
  if not exists (select 1 from public.azal_redeem_tiers()) then raise exception 'redeem_disabled'; end if;
  return pg_catalog.jsonb_build_object(
    'balance', public.azal_points_balance(v_uid),
    'step_points', 10000,
    'cents_per_step', 1000,
    'max_steps', 20
  );
end;
$options$;

revoke all on function public.azal_redeem_tiers() from public, anon, authenticated;
revoke all on function public.azal_redeem_cents(integer) from public, anon, authenticated;
revoke all on function public.redeem_options() from public, anon;
grant execute on function public.redeem_options() to authenticated;

commit;
