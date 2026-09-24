-- Search also matches age/stage and condition, so queries like
-- "ropa 6 meses", "embarazo" or "como nuevo" work. Labels mirror the UI.
-- location_text: accent-free, lower-case "city municipality" for the location
-- filter ("coyoacan" matches "Coyoacán").

alter table public.listings add column if not exists location_text text;

create or replace function public.age_stage_label(s public.age_stage)
returns text
language sql
immutable
set search_path = ''
as $$
  select case s
    when 'pregnancy' then 'embarazo'
    when '0_3m' then '0 3 meses recién nacido'
    when '3_6m' then '3 6 meses'
    when '6_12m' then '6 12 meses'
    when '1_2y' then '1 2 años'
    when '2_4y' then '2 4 años'
    when '4y_plus' then '4 años'
    when 'all_ages' then 'todas las edades'
  end;
$$;

create or replace function public.condition_label(c public.listing_condition)
returns text
language sql
immutable
set search_path = ''
as $$
  select case c
    when 'new_with_tags' then 'nuevo con etiquetas'
    when 'like_new' then 'como nuevo'
    when 'excellent' then 'excelente'
    when 'good' then 'bueno'
    when 'acceptable' then 'aceptable'
  end;
$$;

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
    setweight(to_tsvector('public.es_unaccent', coalesce(stage_labels, '') || ' ' || coalesce(public.condition_label(new.condition), '')), 'B') ||
    setweight(to_tsvector('public.es_unaccent', coalesce(new.description, '')), 'C');
  new.location_text := lower(extensions.unaccent(coalesce(new.city, '') || ' ' || coalesce(new.municipality, '')));
  return new;
end;
$$;

drop trigger if exists listings_search_vector_trg on public.listings;
create trigger listings_search_vector_trg
  before insert or update of title, description, brand, model, category_id, subcategory_id, age_stages, condition, city, municipality
  on public.listings
  for each row execute function public.listings_search_vector();

-- Backfill existing rows.
update public.listings set title = title;

revoke execute on function public.age_stage_label(public.age_stage) from public, anon, authenticated;
revoke execute on function public.condition_label(public.listing_condition) from public, anon, authenticated;
