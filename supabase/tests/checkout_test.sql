-- Checkout RPCs: reservation, double-purchase protection, payment, release.
begin;

create function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'ASSERTION FAILED: %', msg; end if;
end $$;
create function pg_temp.expect_error(stmt text, expected text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if position(expected in sqlerrm) = 0 then
      raise exception 'expected error "%" but got "%" for: %', expected, sqlerrm, stmt;
    end if;
    return;
  end;
  raise exception 'expected error "%" but statement succeeded: %', expected, stmt;
end $$;
grant execute on all functions in schema pg_temp to anon, authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'seller@example.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'buyer@example.com'),
  ('00000000-0000-0000-0000-0000000000c1', 'buyer2@example.com');

insert into public.listings (id, seller_id, title, category_id, condition, age_stages, price_cents, city, delivery_methods, shipping_price_cents, status)
select '40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'Carriola', id, 'good', '{0_3m}',
  450000, 'CDMX', '{pickup,shipping}', 15000, 'active'
from public.categories where slug = 'carriolas';

-- Users cannot call the service-only functions
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1"}', true);
select pg_temp.expect_error($$select public.create_checkout_order('40000000-0000-0000-0000-000000000001', auth.uid(), 'pickup', null, 450000, 0, 10, 45000, 405000)$$, 'permission denied');
select pg_temp.expect_error($$select public.mark_order_paid(gen_random_uuid(), 'pi', 'ch', 1, 0)$$, 'permission denied');
reset role;

-- Amount / rule validation
select pg_temp.expect_error($$select public.create_checkout_order('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'pickup', null, 100, 0, 10, 10, 90)$$, 'price_changed');
select pg_temp.expect_error($$select public.create_checkout_order('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'shipping', '{"city":"CDMX"}', 450000, 0, 10, 45000, 405000)$$, 'shipping_changed');
select pg_temp.expect_error($$select public.create_checkout_order('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'shipping', null, 450000, 15000, 10, 45000, 420000)$$, 'address_required');
select pg_temp.expect_error($$select public.create_checkout_order('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'local_delivery', '{"city":"CDMX"}', 450000, 0, 10, 45000, 405000)$$, 'delivery_not_offered');
select pg_temp.expect_error($$select public.create_checkout_order('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'pickup', null, 450000, 0, 10, 45000, 405000)$$, 'own_listing');
select pg_temp.expect_error($$select public.create_checkout_order('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'pickup', null, 450000, 0, 10, 45000, 999)$$, 'invalid_amounts');

-- Happy path: reserve with shipping
create temp table t (order_id uuid);
insert into t select public.create_checkout_order('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1',
  'shipping', '{"street":"Av. 1","city":"CDMX","postal_code":"04000"}', 450000, 15000, 10, 45000, 420000);
select pg_temp.assert((select status from public.listings where id = '40000000-0000-0000-0000-000000000001') = 'reserved', 'listing reserved');
select pg_temp.assert((select total_cents from public.orders where id = (select order_id from t)) = 465000, 'total includes shipping');
select pg_temp.assert((select count(*) from public.order_items where order_id = (select order_id from t)) = 1, 'order item');

-- A second buyer cannot buy it meanwhile
select pg_temp.expect_error($$select public.create_checkout_order('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 'pickup', null, 450000, 0, 10, 45000, 405000)$$, 'listing_unavailable');

-- Payment confirmed (idempotent)
select pg_temp.expect_error($$select public.mark_order_paid((select order_id from t), 'pi_1', 'ch_1', 1, 0)$$, 'amount_mismatch');
select pg_temp.assert(public.mark_order_paid((select order_id from t), 'pi_1', 'ch_1', 465000, 1850) = 'paid', 'paid');
select pg_temp.assert(public.mark_order_paid((select order_id from t), 'pi_1', 'ch_1', 465000, 1850) = 'already_paid', 'duplicate webhook');
select pg_temp.assert((select status from public.listings where id = '40000000-0000-0000-0000-000000000001') = 'sold', 'listing sold');
select pg_temp.assert((select platform_net_cents from public.orders where id = (select order_id from t)) = 45000 - 1850, 'platform net after fee');
select pg_temp.assert((select count(*) from public.payments where stripe_payment_intent_id = 'pi_1' and status = 'succeeded') = 1, 'payment row');
select pg_temp.assert((select count(*) from public.notifications where data ->> 'order_id' = (select order_id from t)::text) = 2, 'notifications');
select pg_temp.assert(public.cancel_pending_order((select order_id from t)) = false, 'paid order cannot be cancelled as pending');

-- Expired checkout releases the listing
update public.listings set status = 'active' where id = '40000000-0000-0000-0000-000000000001';
update public.orders set status = 'refunded' where id = (select order_id from t);
delete from t;
insert into t select public.create_checkout_order('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 'pickup', null, 450000, 0, 10, 45000, 405000);
select pg_temp.assert(public.cancel_pending_order((select order_id from t)) = true, 'cancelled');
select pg_temp.assert((select status from public.listings where id = '40000000-0000-0000-0000-000000000001') = 'active', 'listing back to active');
-- Late payment for a cancelled order must be refunded
select pg_temp.assert(public.mark_order_paid((select order_id from t), 'pi_late', 'ch_late', 450000, 0) = 'needs_refund', 'late payment refund');

-- Abandoned checkout (no webhook) is released by the next buyer
delete from t;
insert into t select public.create_checkout_order('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'pickup', null, 450000, 0, 10, 45000, 405000);
update public.orders set created_at = now() - interval '1 hour' where id = (select order_id from t);
select pg_temp.assert(public.create_checkout_order('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 'pickup', null, 450000, 0, 10, 45000, 405000) is not null, 'stale reservation released');
select pg_temp.assert((select cancel_reason from public.orders where id = (select order_id from t)) = 'checkout_abandoned', 'stale order cancelled');

rollback;
