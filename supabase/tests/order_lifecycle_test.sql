-- Order lifecycle: who can move an order, disputes, auto-completion, contact, reviews.
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
  ('00000000-0000-0000-0000-0000000000a2', 'seller2@example.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'buyer2@example.com'),
  ('00000000-0000-0000-0000-0000000000c2', 'stranger@example.com');
update public.private_profiles set phone = '5512345678' where id = '00000000-0000-0000-0000-0000000000a2';

insert into public.listings (id, seller_id, title, category_id, condition, age_stages, price_cents, city, delivery_methods, status)
select ('50000000-0000-0000-0000-00000000000' || g)::uuid, '00000000-0000-0000-0000-0000000000a2', 'Producto ' || g, id, 'good', '{0_3m}', 100000, 'CDMX', '{pickup,shipping}', 'active'
from public.categories, generate_series(1, 3) g where slug = 'otros';

create temp table o (n int, id uuid);
insert into o select g, public.create_checkout_order(('50000000-0000-0000-0000-00000000000' || g)::uuid, '00000000-0000-0000-0000-0000000000b2', 'pickup', null, 100000, 0, 10, 10000, 90000)
from generate_series(1, 3) g;
select public.mark_order_paid(id, 'pi_' || n, 'ch_' || n, 100000, 3900) from o;
grant select on o to authenticated;

set local role authenticated;

-- Contact: only participants after payment
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select pg_temp.assert((select phone from public.order_contact((select id from o where n = 1))) = '5512345678', 'buyer sees seller contact');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c2');
select pg_temp.assert((select count(*) from public.order_contact((select id from o where n = 1))) = 0, 'stranger sees nothing');

-- Only the seller ships / delivers, only the buyer confirms
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select pg_temp.expect_error($$select public.order_mark_shipped((select id from o where n = 1), 'DHL', '123')$$, 'invalid_transition');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
select public.order_mark_shipped((select id from o where n = 1), 'DHL', '123');
select pg_temp.expect_error($$select public.order_confirm_received((select id from o where n = 1))$$, 'invalid_transition');
select public.order_mark_delivered((select id from o where n = 1));
select pg_temp.expect_error($$select public.order_mark_delivered((select id from o where n = 1))$$, 'invalid_transition');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000c2');
select pg_temp.expect_error($$select public.order_confirm_received((select id from o where n = 1))$$, 'invalid_transition');

-- Buyer confirms → completed, seller sales counter +1
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select public.order_confirm_received((select id from o where n = 1));
reset role;
select pg_temp.assert((select status from public.orders where id = (select id from o where n = 1)) = 'completed', 'completed');
select pg_temp.assert((select sales_count from public.profiles where id = '00000000-0000-0000-0000-0000000000a2') = 1, 'sales counter');
select pg_temp.assert((select tracking_number from public.orders where id = (select id from o where n = 1)) = '123', 'tracking saved');

-- Reviews both ways after completion; not before
set local role authenticated;
insert into public.reviews (order_id, reviewer_id, reviewee_id, rating, comment)
values ((select id from o where n = 1), '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a2', 5, 'Excelente');
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
insert into public.reviews (order_id, reviewer_id, reviewee_id, rating)
values ((select id from o where n = 1), '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b2', 4);
select pg_temp.expect_error($$insert into public.reviews (order_id, reviewer_id, reviewee_id, rating)
  values ((select id from o where n = 2), '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b2', 4)$$, 'row-level security');

-- Dispute freezes the order
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
select public.order_mark_delivered((select id from o where n = 2));
select pg_temp.act_as('00000000-0000-0000-0000-0000000000b2');
select pg_temp.expect_error($$select public.order_report_problem((select id from o where n = 2), 'mal')$$, 'reason_too_short');
select public.order_report_problem((select id from o where n = 2), 'Llegó con una rueda rota');
select pg_temp.expect_error($$select public.order_confirm_received((select id from o where n = 2))$$, 'invalid_transition');
reset role;

-- Auto-completion: only delivered, past the window, not disputed
select pg_temp.expect_error($$set local role authenticated; select public.complete_due_orders()$$, 'permission denied');
reset role;
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
select public.order_mark_delivered((select id from o where n = 3));
reset role;
select pg_temp.assert((select count(*) from public.complete_due_orders()) = 0, 'not due yet');
update public.orders set delivered_at = now() - interval '4 days' where id in (select id from o where n in (2, 3));
select pg_temp.assert((select array_agg(x) from public.complete_due_orders() x) = array[(select id from o where n = 3)], 'only undisputed due order completed');
select pg_temp.assert((select status from public.orders where id = (select id from o where n = 2)) = 'delivered', 'disputed stays delivered');

rollback;
