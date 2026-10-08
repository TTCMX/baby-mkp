-- Turning a category off hides its products from the public, but not from
-- their seller, their buyer or admins.
begin;

create function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'ASSERTION FAILED: %', msg; end if;
end $$;
grant execute on all functions in schema pg_temp to anon, authenticated;

-- Launch state: clothes only.
select pg_temp.assert((select array_agg(slug) from public.categories where parent_id is null and is_active) = '{ropa}', 'only ropa is on');

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'seller-cat@example.com'),
  ('00000000-0000-0000-0000-0000000000c2', 'buyer-cat@example.com'),
  ('00000000-0000-0000-0000-0000000000c3', 'other-cat@example.com');
insert into public.listings (id, seller_id, title, category_id, condition, age_stages, price_cents, city, delivery_methods, status)
select v.id::uuid, '00000000-0000-0000-0000-0000000000c1', v.title, c.id, 'good', '{0_3m}', 30000, 'CDMX', '{pickup}', v.status::public.listing_status
from (values
  ('91000000-0000-0000-0000-000000000001', 'Pijama', 'ropa', 'active'),
  ('91000000-0000-0000-0000-000000000002', 'Carriola', 'carriolas', 'active'),
  ('91000000-0000-0000-0000-000000000003', 'Silla vendida', 'sillas-de-auto', 'sold')
) as v(id, title, slug, status)
join public.categories c on c.slug = v.slug;
insert into public.orders (buyer_id, seller_id, listing_id, delivery_method, item_price_cents, total_cents,
  commission_percentage, platform_commission_cents, seller_net_cents, status)
values ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c1', '91000000-0000-0000-0000-000000000003',
  'pickup', 30000, 30000, 10, 3000, 27000, 'completed');

set local role anon;
select pg_temp.assert((select array_agg(title) from public.listings where id::text like '91%') = '{Pijama}', 'public sees only clothes');
select pg_temp.assert(not exists (select 1 from public.listing_images i join public.listings l on l.id = i.listing_id where l.title = 'Carriola'), 'no images either');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
select pg_temp.assert((select count(*) from public.listings where id::text like '91%') = 1, 'other users see only clothes');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select pg_temp.assert((select count(*) from public.listings where id::text like '91%') = 3, 'seller sees all their products');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
select pg_temp.assert((select array_agg(title order by title) from public.listings where id::text like '91%') = '{Pijama,"Silla vendida"}', 'buyer still sees what they bought');
reset role;

-- Turning it back on brings the products back.
update public.categories set is_active = true where slug = 'carriolas';
select set_config('request.jwt.claims', '', true);
set local role anon;
select pg_temp.assert((select count(*) from public.listings where id::text like '91%') = 2, 'carriolas back on');
reset role;

rollback;
