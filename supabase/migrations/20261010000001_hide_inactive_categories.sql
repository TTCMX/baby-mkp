-- =============================================================================
-- Turning a category off (Admin → Ajustes → Categorías) now hides its products
-- too: they leave search, the home page, profiles and the product page. Sellers
-- still see their own, buyers their orders' products, admins everything.
-- Launch focus: only clothes for now; the rest can be turned back on from Admin.
-- =============================================================================

-- Buyers keep seeing what they bought (orders aren't readable by anon, hence definer).
create or replace function public.bought_listing(p_listing uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (select 1 from public.orders where listing_id = p_listing and buyer_id = auth.uid());
$$;
revoke execute on function public.bought_listing(uuid) from public;
grant execute on function public.bought_listing(uuid) to anon, authenticated;

drop policy if exists "public listings are visible" on public.listings;
create policy "public listings are visible" on public.listings
  for select using (
    (
      status in ('active', 'reserved', 'sold')
      and exists (select 1 from public.categories c where c.id = category_id and c.is_active)
    )
    or seller_id = auth.uid()
    or public.is_admin()
    or public.bought_listing(id)
  );

update public.categories set is_active = false
where parent_id is null and slug <> 'ropa' and is_active;
