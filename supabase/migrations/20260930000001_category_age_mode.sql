-- =============================================================================
-- How each category relates to the baby's age (configurable in Admin):
--   none  → age doesn't matter (furniture, accessories…): listings are "all ages"
--   range → recommended age range, not strict (toys, shoes, strollers…)
--   exact → specific stages (clothes)
-- =============================================================================

create type public.category_age_mode as enum ('none', 'range', 'exact');

alter table public.categories
  add column if not exists age_mode public.category_age_mode not null default 'exact';

update public.categories set age_mode = 'none'
where slug in ('cunas-y-muebles', 'accesorios', 'monitores-y-electronicos', 'bano-y-cuidado', 'otros');
update public.categories set age_mode = 'range'
where slug in ('juguetes', 'zapatos', 'carriolas', 'sillas-de-auto', 'alimentacion');

-- Listings in an age-less category are always "all ages", whatever the client sends.
-- Existing listings keep their stages until they are edited.
create or replace function public.listings_apply_age_mode()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select age_mode from public.categories where id = new.category_id) = 'none' then
    new.age_stages := '{all_ages}';
  end if;
  return new;
end;
$$;

revoke execute on function public.listings_apply_age_mode() from public, anon, authenticated;

drop trigger if exists listings_apply_age_mode on public.listings;
create trigger listings_apply_age_mode
  before insert or update of category_id, age_stages on public.listings
  for each row execute function public.listings_apply_age_mode();

-- Stage filters and "Para <bebé>" feeds include "all ages" listings, after the
-- ones made for that stage: this column lets the API sort by it.
alter table public.listings
  add column if not exists is_all_ages boolean generated always as (age_stages @> '{all_ages}') stored;
