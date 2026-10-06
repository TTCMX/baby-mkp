-- Managed sellers: admins run their deliveries; buyers see the warehouse contact.
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
create function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
grant execute on all functions in schema pg_temp to anon, authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'lucia.x1@gestionado.invalid'),
  ('00000000-0000-0000-0000-0000000000f2', 'normal@example.com'),
  ('00000000-0000-0000-0000-0000000000f3', 'comprador@example.com'),
  ('00000000-0000-0000-0000-0000000000f4', 'admin@example.com');
update public.profiles set is_managed = true where id = '00000000-0000-0000-0000-0000000000f1';
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000f4';
update public.platform_settings set value = '"bodega@mercadito.baby"' where key = 'managed_contact_email';
update public.platform_settings set value = '"55 0000 1111"' where key = 'managed_contact_phone';
update public.private_profiles set phone = '55 9999 9999' where id = '00000000-0000-0000-0000-0000000000f2';

insert into public.listings (id, seller_id, title, category_id, condition, age_stages, price_cents, city, delivery_methods, status, external_ref)
select ('80000000-0000-0000-0000-00000000000' || g)::uuid,
  case when g = 3 then '00000000-0000-0000-0000-0000000000f2'::uuid else '00000000-0000-0000-0000-0000000000f1'::uuid end,
  'Producto ' || g, id, 'good', '{0_3m}', 100000, 'CDMX', '{pickup}', 'active', 'SKU-' || g
from public.categories, generate_series(1, 3) g where slug = 'ropa';

select pg_temp.expect_error($$insert into public.listings (seller_id, title, category_id, condition, age_stages, price_cents, city, delivery_methods, external_ref)
  select '00000000-0000-0000-0000-0000000000f1', 'Dup', id, 'good', '{0_3m}', 1000, 'CDMX', '{pickup}', 'SKU-1' from public.categories where slug = 'ropa'$$, 'listings_external_ref_key');

create temp table o (n int, id uuid);
grant select on o to authenticated;
insert into o select g, public.create_checkout_order(('80000000-0000-0000-0000-00000000000' || g)::uuid, '00000000-0000-0000-0000-0000000000f3', 'pickup', null, 100000, 0, 10, 10000, 90000)
from generate_series(1, 3) g;
select public.mark_order_paid(id, 'pi_m' || n, 'ch_m' || n, 100000, 0) from o;

set local role authenticated;
-- Buyer sees the warehouse contact for a managed seller, the real one otherwise
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f3');
select pg_temp.assert((select email || '|' || phone from public.order_contact((select id from o where n = 1))) = 'bodega@mercadito.baby|55 0000 1111', 'warehouse contact');
select pg_temp.assert((select phone from public.order_contact((select id from o where n = 3))) = '55 9999 9999', 'normal seller contact');
-- Nobody but an admin can act for a managed seller
select pg_temp.expect_error($$select public.order_mark_shipped((select id from o where n = 1), 'DHL', '1')$$, 'invalid_transition');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f2');
select pg_temp.expect_error($$select public.order_mark_shipped((select id from o where n = 1), 'DHL', '1')$$, 'invalid_transition');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f4');
select public.order_mark_shipped((select id from o where n = 1), 'DHL', '123');
select public.order_mark_delivered((select id from o where n = 1));
select public.order_mark_delivered((select id from o where n = 2));
-- …but an admin can't step in for a normal seller
select pg_temp.expect_error($$select public.order_mark_delivered((select id from o where n = 3))$$, 'invalid_transition');
-- Users can't withdraw for someone else, nor mark themselves as managed
select pg_temp.expect_error($$select public.withdraw_for('00000000-0000-0000-0000-0000000000f1', 100)$$, 'permission denied');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000f2');
select pg_temp.expect_error($$update public.profiles set is_managed = true where id = auth.uid()$$, 'permission denied');
reset role;
select pg_temp.assert((select status from public.orders where id = (select id from o where n = 1)) = 'delivered', 'admin delivered managed order');

-- Completed → managed seller's balance; the server withdraws for them
update public.orders set status = 'completed', completed_at = now() where id in (select id from o where n in (1, 2));
select pg_temp.assert((select balance_cents from public.wallets where user_id = '00000000-0000-0000-0000-0000000000f1') = 180000, 'managed balance');
insert into public.bank_accounts (user_id, clabe, holder_name, bank_name)
values ('00000000-0000-0000-0000-0000000000f1', '002180001234567896', 'Lucía Martínez', 'Banamex');
select pg_temp.assert((select amount_cents from public.withdraw_for('00000000-0000-0000-0000-0000000000f1', 180000)) = 180000, 'withdrawal for managed seller');
select pg_temp.assert((select balance_cents from public.wallets where user_id = '00000000-0000-0000-0000-0000000000f1') = 0, 'balance withdrawn');

rollback;
