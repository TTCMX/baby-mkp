-- =============================================================================
-- Gender of an item (mostly clothes and shoes): niña / niño / unisex. Optional:
-- strollers or furniture don't need one. Filtering by "niña" also shows unisex.
-- =============================================================================

create type public.listing_gender as enum ('girl', 'boy', 'unisex');

alter table public.listings add column if not exists gender public.listing_gender;

-- Sellers set it like any other editable field (column-level grants).
grant insert (gender), update (gender) on public.listings to authenticated;

create or replace function public.gender_label(g public.listing_gender)
returns text
language sql
immutable
set search_path = ''
as $$
  select case g
    when 'girl' then 'niña nena'
    when 'boy' then 'niño nene'
    when 'unisex' then 'unisex niña niño'
  end;
$$;

-- Search: "vestido niña" also matches by the field, not only by the words in the title.
create or replace function public.listings_search_vector()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  category_names text;
  stage_labels text;
begin
  select string_agg(c.name, ' ') into category_names
  from public.categories c
  where c.id in (new.category_id, new.subcategory_id);

  select string_agg(public.age_stage_label(s), ' ') into stage_labels
  from unnest(new.age_stages) as s;

  new.search_vector :=
    setweight(to_tsvector('public.es_unaccent', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('public.es_unaccent', coalesce(new.brand, '') || ' ' || coalesce(new.model, '')), 'A') ||
    setweight(to_tsvector('public.es_unaccent', coalesce(category_names, '')), 'B') ||
    setweight(to_tsvector('public.es_unaccent', coalesce(stage_labels, '') || ' ' || coalesce(public.condition_label(new.condition), '')
      || ' ' || coalesce(public.gender_label(new.gender), '')), 'B') ||
    setweight(to_tsvector('public.es_unaccent', coalesce(new.description, '')), 'C');
  new.location_text := lower(extensions.unaccent(coalesce(new.city, '') || ' ' || coalesce(new.municipality, '')));
  return new;
end;
$$;

drop trigger if exists listings_search_vector_trg on public.listings;
create trigger listings_search_vector_trg
  before insert or update of title, description, brand, model, category_id, subcategory_id, age_stages, condition, gender, city, municipality
  on public.listings
  for each row execute function public.listings_search_vector();

create index if not exists listings_gender_idx on public.listings (gender) where status = 'active';

revoke execute on function public.gender_label(public.listing_gender) from public, anon, authenticated;
