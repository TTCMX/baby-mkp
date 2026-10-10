-- Shipping orders: no skipping the label, no confirming before it ships, admins notified.
begin;
update public.categories set is_active = true;

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
create function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
grant execute on all functions in schema pg_temp to anon, authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'seller-ship@example.com'),
  ('00000000-0000-0000-0000-0000000000d2', 'buyer-ship@example.com'),
  ('00000000-0000-0000-0000-0000000000d3', 'admin-ship@example.com');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000d3';
update public.platform_settings set value = '9900' where key = 'shipping_price_cents';

insert into public.listings (id, seller_id, title, category_id, condition, age_stages, price_cents, city, delivery_methods, status)
select ('92000000-0000-0000-0000-00000000000' || g)::uuid, '00000000-0000-0000-0000-0000000000d1', 'Mameluco ' || g, id, 'good', '{0_3m}', 30000, 'CDMX', '{pickup,shipping}', 'active'
from public.categories, generate_series(1, 2) g where slug = 'ropa';

create temp table o (n int, id uuid);
grant select on o to authenticated;
insert into o select 1, public.create_checkout_order('92000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d2',
  'shipping', '{"street":"Av. 1","city":"CDMX","postal_code":"04000"}', 30000, 9900, 10, 3000, 27000);
insert into o select 2, public.create_checkout_order('92000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000d2',
  'pickup', null, 30000, 0, 10, 3000, 27000);
select public.mark_order_paid((select id from o where n = 1), 'pi_s1', 'ch_s1', 39900, 0);
select public.mark_order_paid((select id from o where n = 2), 'pi_s2', 'ch_s2', 30000, 0);

-- Admins are told what to do with each paid order.
select pg_temp.assert((select count(*) from public.notifications
  where user_id = '00000000-0000-0000-0000-0000000000d3' and type = 'admin_label_needed'
    and link = '/admin/orders/' || (select id from o where n = 1)) = 1, 'admin notified: label needed');
select pg_temp.assert((select count(*) from public.notifications
  where user_id = '00000000-0000-0000-0000-0000000000d3' and data ->> 'order_id' = (select id from o where n = 2)::text) = 0,
  'own-seller pickup: nothing for admins');

set local role authenticated;
-- Seller can't jump paid → delivered on a shipping order (it would skip the label).
select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select pg_temp.expect_error($$select public.order_mark_delivered((select id from o where n = 1))$$, 'invalid_transition');
-- Buyer can't "receive" a shipping order that hasn't shipped.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000d2');
select pg_temp.expect_error($$select public.order_confirm_received((select id from o where n = 1))$$, 'invalid_transition');
-- Pickup: handed over early, the buyer can confirm right away.
select public.order_confirm_received((select id from o where n = 2));
reset role;
select pg_temp.assert((select status from public.orders where id = (select id from o where n = 2)) = 'completed', 'pickup confirmed while paid');

-- With the label it ships, then it can be delivered and received.
update public.orders set shipping_label_url = 'https://labels.example.com/x.pdf', tracking_carrier = 'DHL', tracking_number = '1'
where id = (select id from o where n = 1);
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000d1');
select public.order_mark_shipped((select id from o where n = 1), '', '');
select public.order_mark_delivered((select id from o where n = 1));
select pg_temp.act_as('00000000-0000-0000-0000-0000000000d2');
select public.order_confirm_received((select id from o where n = 1));
reset role;
select pg_temp.assert((select status from public.orders where id = (select id from o where n = 1)) = 'completed', 'shipping order completed in order');

rollback;
