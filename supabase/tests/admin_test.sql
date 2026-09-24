-- Admin: audit log visibility and metrics.
begin;
create function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'ASSERTION FAILED: %', msg; end if;
end $$;
create function pg_temp.expect_error(stmt text, expected text) returns void language plpgsql as $$
begin
  begin execute stmt; exception when others then
    if position(expected in sqlerrm) = 0 then raise exception 'expected "%" got "%"', expected, sqlerrm; end if;
    return;
  end;
  raise exception 'expected error "%" but statement succeeded', expected;
end $$;
grant execute on all functions in schema pg_temp to authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a3', 's@example.com'),
  ('00000000-0000-0000-0000-0000000000b3', 'b@example.com'),
  ('00000000-0000-0000-0000-0000000000d3', 'admin3@example.com');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000d3';

insert into public.listings (id, seller_id, title, category_id, condition, age_stages, price_cents, city, delivery_methods, status, published_at)
select ('60000000-0000-0000-0000-00000000000' || g)::uuid, '00000000-0000-0000-0000-0000000000a3', 'Producto ' || g, id, 'good', '{0_3m}', 100000 * g, 'CDMX', '{pickup}', 'active', now() - interval '10 days'
from public.categories, generate_series(1, 3) g where slug = 'otros';
select public.mark_order_paid(public.create_checkout_order(('60000000-0000-0000-0000-00000000000' || g)::uuid, '00000000-0000-0000-0000-0000000000b3', 'pickup', null, 100000 * g, 0, 10, 10000 * g, 90000 * g), 'pi_m' || g, 'ch_m' || g, 100000 * g, 1000)
from generate_series(1, 2) g;

select pg_temp.assert((public.admin_metrics() ->> 'gmv_cents')::int = 300000, 'gmv');
select pg_temp.assert((public.admin_metrics() ->> 'revenue_cents')::int = 30000, 'revenue');
select pg_temp.assert((public.admin_metrics() ->> 'net_revenue_cents')::int = 28000, 'net revenue after fees');
select pg_temp.assert((public.admin_metrics() ->> 'take_rate')::numeric = 0.1, 'take rate');
select pg_temp.assert((public.admin_metrics() ->> 'sold_listings')::int = 2 and (public.admin_metrics() ->> 'active_listings')::int = 1, 'listings');
select pg_temp.assert((public.admin_metrics() ->> 'sell_through')::numeric = 0.6667, 'sell-through');
select pg_temp.assert((public.admin_metrics() ->> 'avg_days_to_sale')::numeric between 9.9 and 10.1, 'days to sale');

insert into public.admin_audit_log (admin_id, action, entity_type, entity_id) values ('00000000-0000-0000-0000-0000000000d3', 'test', 'order', 'x');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b3"}', true);
select pg_temp.assert((select count(*) from public.admin_audit_log) = 0, 'users cannot read audit log');
select pg_temp.expect_error($$select public.admin_metrics()$$, 'permission denied');
select pg_temp.expect_error($$insert into public.admin_audit_log (action, entity_type) values ('x','y')$$, 'permission denied');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d3"}', true);
select pg_temp.assert((select count(*) from public.admin_audit_log) = 1, 'admin reads audit log');
rollback;
