-- Listing gender: searchable, and sellers can set it on their own listings.
begin;

create function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'ASSERTION FAILED: %', msg; end if;
end $$;
grant execute on all functions in schema pg_temp to anon, authenticated;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d7', 'gender@example.com');
insert into public.listings (id, seller_id, title, category_id, condition, age_stages, price_cents, city, delivery_methods, status, gender)
select '90000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d7', 'Vestido de flores', id, 'good', '{0_3m}', 30000, 'CDMX', '{pickup}', 'active', 'girl'
from public.categories where slug = 'ropa';

select pg_temp.assert((select search_vector @@ to_tsquery('public.es_unaccent', 'nina') from public.listings where id = '90000000-0000-0000-0000-000000000001'), 'searchable as niña');
-- (The Spanish stemmer folds niña/niño to the same root: telling them apart is the filter's job.)

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d7","role":"authenticated"}', true);
update public.listings set gender = 'unisex' where id = '90000000-0000-0000-0000-000000000001';
reset role;
select pg_temp.assert((select gender = 'unisex' and search_vector @@ to_tsquery('public.es_unaccent', 'unisex') from public.listings where id = '90000000-0000-0000-0000-000000000001'), 'seller changed it; search vector refreshed');

rollback;
