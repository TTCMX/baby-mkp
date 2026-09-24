-- Replaces the full, ordered photo set of a listing in one atomic call
-- (reorder, add, remove, change main photo). SECURITY INVOKER: the caller's
-- RLS policies on listing_images still apply (own, editable listing only).
create or replace function public.replace_listing_images(p_listing_id uuid, p_images jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  max_images integer := coalesce((public.get_setting('max_images_per_listing'))::integer, 12);
  n integer := coalesce(jsonb_array_length(p_images), 0);
begin
  if n = 0 then
    raise exception 'missing_images' using errcode = '22023';
  end if;
  if n > max_images then
    raise exception 'too_many_images' using errcode = '22023';
  end if;

  delete from public.listing_images where listing_id = p_listing_id;

  insert into public.listing_images (listing_id, storage_path, position, width, height)
  select p_listing_id, e.value ->> 'storage_path', (e.ord - 1)::smallint,
         (e.value ->> 'width')::integer, (e.value ->> 'height')::integer
  from jsonb_array_elements(p_images) with ordinality as e(value, ord);
end;
$$;

revoke execute on function public.replace_listing_images(uuid, jsonb) from public, anon;
grant execute on function public.replace_listing_images(uuid, jsonb) to authenticated;
