-- Category age modes: age-less categories force "all ages"; others keep the seller's stages.
begin;
-- Fixtures use every category; production launches with only some turned on.
update public.categories set is_active = true;

create function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'ASSERTION FAILED: %', msg; end if;
end $$;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d1', 'agemode@example.com');

insert into public.listings (id, seller_id, title, category_id, condition, age_stages, price_cents, city, delivery_methods)
select '60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d1', 'Cuna', id, 'good', '{0_3m}', 100000, 'CDMX', '{pickup}'
from public.categories where slug = 'cunas-y-muebles';
insert into public.listings (id, seller_id, title, category_id, condition, age_stages, price_cents, city, delivery_methods)
select '60000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000d1', 'Sonaja', id, 'good', '{0_3m,3_6m}', 10000, 'CDMX', '{pickup}'
from public.categories where slug = 'juguetes';

select pg_temp.assert((select age_stages = '{all_ages}' and is_all_ages from public.listings where id = '60000000-0000-0000-0000-000000000001'), 'none mode forces all ages');
select pg_temp.assert((select age_stages = '{0_3m,3_6m}' and not is_all_ages from public.listings where id = '60000000-0000-0000-0000-000000000002'), 'range mode keeps stages');

-- Moving a listing into an age-less category resets its stages too
update public.listings set category_id = (select id from public.categories where slug = 'accesorios')
where id = '60000000-0000-0000-0000-000000000002';
select pg_temp.assert((select age_stages = '{all_ages}' from public.listings where id = '60000000-0000-0000-0000-000000000002'), 'recategorised to none');

rollback;
