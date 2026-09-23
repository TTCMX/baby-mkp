-- =============================================================================
-- Security: privileges, Row Level Security and business RPCs
--
-- Model
--   * anon / authenticated get the minimum table privileges, granted
--     explicitly (Supabase grants ALL by default; we revoke it first).
--   * Column-level grants stop users from touching sensitive columns
--     (status, role, counters, Stripe ids...). Those change only through
--     SECURITY DEFINER functions below or the server's service role.
--   * Orders, payments and payouts are written only by the server
--     (service role) from checkout and Stripe webhooks.
-- =============================================================================

revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- Helpers used inside policies must stay callable.
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_active_user() to anon, authenticated;
grant execute on function public.get_setting(text) to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.private_profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.platform_settings enable row level security;
alter table public.categories enable row level security;
alter table public.brands enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
alter table public.favorites enable row level security;
alter table public.wishlists enable row level security;
alter table public.concierge_requests enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.payouts enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.reviews enable row level security;
alter table public.notifications enable row level security;

-- -----------------------------------------------------------------------------
-- profiles: public read; owners edit only their public fields
-- -----------------------------------------------------------------------------
grant select on public.profiles to anon, authenticated;
grant update (username, display_name, avatar_url, bio, city, municipality)
  on public.profiles to authenticated;

create policy "profiles are public" on public.profiles
  for select using (true);
create policy "users update own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- -----------------------------------------------------------------------------
-- private_profiles / addresses: owner (and admin read) only
-- -----------------------------------------------------------------------------
grant select on public.private_profiles to authenticated;
grant update (phone) on public.private_profiles to authenticated;

create policy "owner or admin reads private profile" on public.private_profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "owner updates private profile" on public.private_profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

grant select, insert, update, delete on public.addresses to authenticated;

create policy "owner manages addresses" on public.addresses
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- platform_settings / categories / brands: public read, admin write
-- -----------------------------------------------------------------------------
grant select on public.platform_settings, public.categories, public.brands to anon, authenticated;
grant insert, update, delete on public.platform_settings, public.categories, public.brands to authenticated;

create policy "settings are public" on public.platform_settings for select using (true);
create policy "admin writes settings" on public.platform_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "active categories are public" on public.categories
  for select using (is_active or public.is_admin());
create policy "admin writes categories" on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "active brands are public" on public.brands
  for select using (is_active or public.is_admin());
create policy "admin writes brands" on public.brands
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- listings
-- -----------------------------------------------------------------------------
grant select on public.listings to anon, authenticated;
grant insert (
  id, seller_id, title, description, category_id, subcategory_id, brand_id, brand, model,
  condition, age_stages, listing_type, bundle_item_count, price_cents, city,
  municipality, state, delivery_methods, shipping_price_cents
) on public.listings to authenticated;
grant update (
  title, description, category_id, subcategory_id, brand_id, brand, model,
  condition, age_stages, listing_type, bundle_item_count, price_cents, city,
  municipality, state, delivery_methods, shipping_price_cents
) on public.listings to authenticated;
grant delete on public.listings to authenticated;

create policy "public listings are visible" on public.listings
  for select using (
    status in ('active', 'reserved', 'sold')
    or seller_id = auth.uid()
    or public.is_admin()
  );
create policy "sellers create draft listings" on public.listings
  for insert to authenticated
  with check (
    seller_id = auth.uid()
    and status = 'draft'
    and sale_channel = 'self_service'
    and public.is_active_user()
  );
create policy "sellers edit own listings" on public.listings
  for update to authenticated
  using (seller_id = auth.uid() and status not in ('reserved', 'sold'))
  with check (seller_id = auth.uid());
create policy "sellers delete unpublished listings" on public.listings
  for delete to authenticated
  using (seller_id = auth.uid() and status in ('draft', 'inactive', 'rejected'));

-- -----------------------------------------------------------------------------
-- listing_images
-- -----------------------------------------------------------------------------
grant select on public.listing_images to anon, authenticated;
grant insert (listing_id, storage_path, position, width, height),
      update (position),
      delete
  on public.listing_images to authenticated;

create policy "images follow listing visibility" on public.listing_images
  for select using (
    exists (select 1 from public.listings l where l.id = listing_id)
  );
create policy "sellers manage images of editable listings" on public.listing_images
  for all to authenticated
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_id and l.seller_id = auth.uid()
        and l.status not in ('reserved', 'sold')
    )
  )
  with check (
    split_part(storage_path, '/', 1) = auth.uid()::text
    and exists (
      select 1 from public.listings l
      where l.id = listing_id and l.seller_id = auth.uid()
        and l.status not in ('reserved', 'sold')
    )
  );

-- -----------------------------------------------------------------------------
-- favorites / wishlists: owner only
-- -----------------------------------------------------------------------------
grant select, insert, delete on public.favorites to authenticated;

create policy "owner reads favorites" on public.favorites
  for select to authenticated using (user_id = auth.uid());
create policy "owner adds favorites" on public.favorites
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.listings l where l.id = listing_id and l.status in ('active', 'reserved'))
  );
create policy "owner removes favorites" on public.favorites
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on public.wishlists to authenticated;

create policy "owner manages wishlists" on public.wishlists
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- concierge_requests: owner creates / edits while submitted; admin via server
-- -----------------------------------------------------------------------------
grant select on public.concierge_requests to authenticated;
grant insert (
  id, user_id, title, description, category_id, brand, model, condition,
  expected_price_cents, city, municipality, image_paths
) on public.concierge_requests to authenticated;
grant update (
  title, description, category_id, brand, model, condition,
  expected_price_cents, city, municipality, image_paths
) on public.concierge_requests to authenticated;

create policy "owner or admin reads concierge" on public.concierge_requests
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "owner submits concierge" on public.concierge_requests
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'submitted' and public.is_active_user());
create policy "owner edits submitted concierge" on public.concierge_requests
  for update to authenticated
  using (user_id = auth.uid() and status = 'submitted')
  with check (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- orders / order_items / payments / payouts: read-only for participants
-- -----------------------------------------------------------------------------
grant select on public.orders, public.order_items, public.payments, public.payouts to authenticated;

create policy "participants read orders" on public.orders
  for select to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());
create policy "participants read order items" on public.order_items
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));
create policy "buyer or admin reads payments" on public.payments
  for select to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = auth.uid())
  );
create policy "seller or admin reads payouts" on public.payouts
  for select to authenticated
  using (seller_id = auth.uid() or public.is_admin());

-- -----------------------------------------------------------------------------
-- conversations / messages
-- -----------------------------------------------------------------------------
grant select on public.conversations to authenticated;
grant insert (id, listing_id, buyer_id, seller_id) on public.conversations to authenticated;

create policy "participants read conversations" on public.conversations
  for select to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());
create policy "buyers start conversations" on public.conversations
  for insert to authenticated
  with check (
    buyer_id = auth.uid()
    and public.is_active_user()
    and exists (
      select 1 from public.listings l
      where l.id = listing_id and l.seller_id = conversations.seller_id
        and l.status in ('active', 'reserved')
    )
  );

grant select on public.messages to authenticated;
grant insert (conversation_id, sender_id, body), update (read_at) on public.messages to authenticated;

create policy "participants read messages" on public.messages
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.conversations c
      where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id)
    )
  );
create policy "participants send messages" on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_active_user()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id)
    )
  );
create policy "recipient marks messages read" on public.messages
  for update to authenticated
  using (
    sender_id <> auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id)
    )
  );

-- -----------------------------------------------------------------------------
-- reviews: public read; participants of a completed order write once
-- -----------------------------------------------------------------------------
grant select on public.reviews to anon, authenticated;
grant insert (order_id, reviewer_id, reviewee_id, rating, comment) on public.reviews to authenticated;

create policy "reviews are public" on public.reviews for select using (true);
create policy "participants review completed orders" on public.reviews
  for insert to authenticated
  with check (
    reviewer_id = auth.uid()
    and exists (
      select 1 from public.orders o
      where o.id = order_id
        and o.status = 'completed'
        and (
          (o.buyer_id = auth.uid() and o.seller_id = reviews.reviewee_id)
          or (o.seller_id = auth.uid() and o.buyer_id = reviews.reviewee_id)
        )
    )
  );

-- -----------------------------------------------------------------------------
-- notifications: owner reads and marks as read
-- -----------------------------------------------------------------------------
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy "owner reads notifications" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "owner marks notifications read" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =============================================================================
-- Business RPCs (SECURITY DEFINER: they validate the caller themselves)
-- =============================================================================

-- Seller publishes a draft / inactive / rejected listing.
-- Goes to `pending_review` when moderation is enabled, otherwise `active`.
create or replace function public.publish_listing(p_listing_id uuid)
returns public.listing_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.listings;
  c_allows_shipping boolean;
  next_status public.listing_status;
begin
  if not public.is_active_user() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  select * into l from public.listings where id = p_listing_id for update;
  if not found or l.seller_id <> auth.uid() then
    raise exception 'listing_not_found' using errcode = 'P0002';
  end if;
  if l.status not in ('draft', 'inactive', 'rejected') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if not exists (select 1 from public.listing_images where listing_id = l.id) then
    raise exception 'missing_images' using errcode = '22023';
  end if;
  if cardinality(l.age_stages) = 0 then
    raise exception 'missing_age_stage' using errcode = '22023';
  end if;

  select allows_shipping into c_allows_shipping from public.categories where id = l.category_id;
  if not coalesce(c_allows_shipping, true) and 'shipping' = any (l.delivery_methods) then
    raise exception 'shipping_not_allowed' using errcode = '22023';
  end if;

  if coalesce((public.get_setting('listings_require_review'))::boolean, false) then
    next_status := 'pending_review';
  else
    next_status := 'active';
  end if;

  update public.listings
  set status = next_status,
      rejection_reason = null,
      published_at = case when next_status = 'active' then coalesce(published_at, now()) else published_at end
  where id = l.id;

  return next_status;
end;
$$;

-- Seller takes an active listing off the catalogue.
create or replace function public.unpublish_listing(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.listings
  set status = 'inactive'
  where id = p_listing_id
    and seller_id = auth.uid()
    and status in ('active', 'pending_review');
  if not found then
    raise exception 'listing_not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- Counts a listing view (anonymous allowed). Owner views are not counted.
create or replace function public.record_listing_view(p_listing_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.listings
  set view_count = view_count + 1
  where id = p_listing_id
    and status = 'active'
    and seller_id is distinct from auth.uid();
$$;

grant execute on function public.publish_listing(uuid) to authenticated;
grant execute on function public.unpublish_listing(uuid) to authenticated;
grant execute on function public.record_listing_view(uuid) to anon, authenticated;

-- Keep seller sales counters in sync when an order completes.
create or replace function public.orders_on_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    update public.profiles set sales_count = sales_count + 1 where id = new.seller_id;
  elsif old.status = 'completed' and new.status is distinct from 'completed' then
    update public.profiles set sales_count = greatest(sales_count - 1, 0) where id = new.seller_id;
  end if;
  return null;
end;
$$;
create trigger orders_on_status_change_trg
  after update of status on public.orders
  for each row execute function public.orders_on_status_change();
