select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000d1',false);
set role authenticated;
select public.pay_order_test((select id from public.orders where idempotency_key='race-key-0000000002'),'tok_test_ok')->>'outcome';
