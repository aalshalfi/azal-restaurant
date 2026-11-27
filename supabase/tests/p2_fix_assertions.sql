-- P2-FIX staging assertions. Run only after the reviewed migration on isolated AZAL staging.
-- Every fixture is synthetic and the whole script rolls back.
begin;

do $$
declare
  v_admin uuid := gen_random_uuid();
  v_staff uuid := gen_random_uuid();
  v_auth_user uuid := gen_random_uuid();
  v_order uuid := gen_random_uuid();
  v_test_branch text := 'p2-test-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
  v_email text;
begin
  insert into public.branches (slug, name_en, name_fr, city, timezone, tax_rate_bps, active)
  values (v_test_branch, 'P2 test branch', 'Succursale test P2', 'Test', 'America/Toronto', 1300, true);

  insert into public.profiles (id) values (v_admin), (v_staff);
  insert into public.user_roles (user_id, role)
  values (v_admin, 'admin'), (v_staff, 'staff');
  insert into public.staff_branch_access (user_id, branch_slug)
  values (v_staff, v_test_branch);

  -- R1: an admin with no staff_branch_access rows is still an admin.
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  if exists (select 1 from public.staff_branch_access where user_id = v_admin) then
    raise exception 'R1 fixture invalid: admin unexpectedly has branch access';
  end if;
  if not public.azal_staff_can_access('ottawa') then
    raise exception 'R1 failed: branch-less admin cannot access Ottawa';
  end if;

  -- R1: staff can access only explicitly assigned branches.
  perform set_config('request.jwt.claim.sub', v_staff::text, true);
  if not public.azal_staff_can_access(v_test_branch) then
    raise exception 'R1 failed: assigned staff cannot access assigned branch';
  end if;
  if public.azal_staff_can_access('ottawa') then
    raise exception 'R1 failed: staff can access an unassigned branch';
  end if;

  -- R3: a new Auth identity creates only a minimal profile id row.
  v_email := 'azal-p2-' || replace(v_auth_user::text, '-', '') || '@example.invalid';
  insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  values (v_auth_user, 'authenticated', 'authenticated', v_email, '', now(), now(), now());
  if not exists (select 1 from public.profiles where id = v_auth_user) then
    raise exception 'R3 failed: Auth insert did not create a profile row';
  end if;
  if exists (select 1 from public.profiles where id = v_auth_user and display_name is not null) then
    raise exception 'R3 failed: profile trigger copied or invented a display name';
  end if;

  -- R2: prepare one source order and prove each per-order event type is unique.
  insert into public.orders (id, branch_slug, user_id, idempotency_key, request_hash, subtotal_cents, tax_rate_bps, tax_cents, total_cents)
  values (v_order, 'ottawa', v_admin, 'p2-fix-' || v_order::text, repeat('a', 64), 100, 1300, 13, 113);

  insert into public.points_ledger (user_id, order_id, event_key, entry_type, delta_points, reason)
  values (v_admin, v_order, 'p2-earn:' || v_order::text, 'earn', 1, 'staging assertion');
  begin
    insert into public.points_ledger (user_id, order_id, event_key, entry_type, delta_points, reason)
    values (v_admin, v_order, 'p2-earn-duplicate:' || v_order::text, 'earn', 1, 'duplicate must fail');
    raise exception 'R2 failed: duplicate earn was accepted';
  exception when unique_violation then null;
  end;

  insert into public.points_ledger (user_id, order_id, event_key, entry_type, delta_points, reason)
  values (v_admin, v_order, 'p2-reversal:' || v_order::text, 'earn_reversal', -1, 'staging assertion');
  begin
    insert into public.points_ledger (user_id, order_id, event_key, entry_type, delta_points, reason)
    values (v_admin, v_order, 'p2-reversal-duplicate:' || v_order::text, 'earn_reversal', -1, 'duplicate must fail');
    raise exception 'R2 failed: duplicate earn reversal was accepted';
  exception when unique_violation then null;
  end;

  insert into public.points_ledger (user_id, order_id, event_key, entry_type, delta_points, reason)
  values (v_admin, v_order, 'p2-refund:' || v_order::text, 'redeem_refund', 1, 'staging assertion');
  begin
    insert into public.points_ledger (user_id, order_id, event_key, entry_type, delta_points, reason)
    values (v_admin, v_order, 'p2-refund-duplicate:' || v_order::text, 'redeem_refund', 1, 'duplicate must fail');
    raise exception 'R2 failed: duplicate redemption refund was accepted';
  exception when unique_violation then null;
  end;
end;
$$;

rollback;

-- Success means the DO block completed without an exception and the transaction rolled back.