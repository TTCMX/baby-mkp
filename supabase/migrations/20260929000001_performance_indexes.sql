-- =============================================================================
-- Performance audit: indexes for the catalogue filters and missing FK indexes.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

-- "Ciudad" filter and "Cerca de ti" use ILIKE on the normalized location, and the
-- brand filter uses ILIKE '%…%': trigram indexes serve both (only active listings
-- are ever searched).
create index if not exists listings_location_trgm_idx on public.listings
  using gin (location_text extensions.gin_trgm_ops) where status = 'active';
create index if not exists listings_brand_trgm_idx on public.listings
  using gin (brand extensions.gin_trgm_ops) where status = 'active';

-- Category pages match category_id OR subcategory_id.
create index if not exists listings_subcategory_idx on public.listings (subcategory_id, status)
  where subcategory_id is not null;

-- "Populares" on the home page.
create index if not exists listings_popular_idx on public.listings (favorite_count desc, view_count desc)
  where status = 'active' and favorite_count > 0;

-- Foreign keys without an index (joins, and deletes on the referenced rows).
create index if not exists listings_brand_id_idx on public.listings (brand_id) where brand_id is not null;
create index if not exists order_items_listing_idx on public.order_items (listing_id);
create index if not exists messages_sender_idx on public.messages (sender_id);
create index if not exists reviews_reviewer_idx on public.reviews (reviewer_id);
create index if not exists concierge_requests_listing_idx on public.concierge_requests (listing_id)
  where listing_id is not null;
create index if not exists admin_audit_log_admin_idx on public.admin_audit_log (admin_id);

-- Trigger functions are never called directly: nobody needs EXECUTE on them.
revoke execute on function public.babies_limit() from public, anon, authenticated;
revoke execute on function public.orders_on_status_change() from public, anon, authenticated;
