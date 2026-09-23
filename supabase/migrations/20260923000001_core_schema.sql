-- =============================================================================
-- Baby Recommerce — core schema
--
-- Conventions
--   * Money is stored as integer cents (MXN by default). Never floats.
--   * Percentages are numeric(5,2) (e.g. 10.00 = 10 %).
--   * Every table has created_at; mutable tables have updated_at (trigger).
--   * Public vs private data is split by table (profiles vs private_profiles,
--     addresses) so RLS stays simple and private data is never exposed.
--   * `auth.users` (Supabase Auth) is the "users" table of the spec.
-- =============================================================================

create extension if not exists unaccent with schema extensions;

-- -----------------------------------------------------------------------------
-- Enums (small, stable vocabularies; human labels live in the app)
-- -----------------------------------------------------------------------------
create type public.user_role as enum ('user', 'admin');
create type public.account_status as enum ('active', 'suspended');

create type public.listing_status as enum (
  'draft', 'pending_review', 'active', 'reserved', 'sold', 'inactive', 'rejected'
);
create type public.listing_condition as enum (
  'new_with_tags', 'like_new', 'excellent', 'good', 'acceptable'
);
create type public.age_stage as enum (
  'pregnancy', '0_3m', '3_6m', '6_12m', '1_2y', '2_4y', '4y_plus', 'all_ages'
);
create type public.listing_type as enum ('single', 'bundle');
create type public.sale_channel as enum ('self_service', 'concierge');
create type public.delivery_method as enum ('shipping', 'local_delivery', 'pickup');

create type public.order_status as enum (
  'pending_payment', 'paid', 'in_delivery', 'delivered', 'completed', 'cancelled', 'refunded'
);
create type public.payment_status as enum (
  'requires_payment', 'processing', 'succeeded', 'failed', 'refunded', 'partially_refunded'
);
create type public.payout_status as enum ('pending', 'in_transit', 'paid', 'failed', 'cancelled');
create type public.concierge_status as enum (
  'submitted', 'under_review', 'accepted', 'rejected', 'listed', 'sold', 'cancelled'
);

-- -----------------------------------------------------------------------------
-- Generic helpers
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Spanish full text search that ignores accents ("cuna" matches "cúna").
create text search configuration public.es_unaccent (copy = pg_catalog.spanish);
alter text search configuration public.es_unaccent
  alter mapping for hword, hword_part, word with extensions.unaccent, spanish_stem;

-- -----------------------------------------------------------------------------
-- Profiles (public) and private profile data
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text not null check (char_length(display_name) between 1 and 60),
  avatar_url text,
  bio text check (char_length(bio) <= 500),
  city text check (char_length(city) <= 80),
  municipality text check (char_length(municipality) <= 80),
  role public.user_role not null default 'user',
  status public.account_status not null default 'active',
  -- Denormalised reputation counters, maintained by triggers.
  sales_count integer not null default 0,
  rating_avg numeric(3,2),
  rating_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,30}$')
);
create unique index profiles_username_key on public.profiles (username);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.private_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,
  email text,
  phone text check (char_length(phone) <= 30),
  -- Stripe Connect: written only by the server (service role).
  stripe_account_id text unique,
  stripe_customer_id text unique,
  payouts_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger private_profiles_updated_at before update on public.private_profiles
  for each row execute function public.set_updated_at();

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text check (char_length(label) <= 40),
  recipient_name text not null check (char_length(recipient_name) between 1 and 120),
  phone text check (char_length(phone) <= 30),
  street text not null check (char_length(street) <= 200),
  exterior_number text check (char_length(exterior_number) <= 20),
  interior_number text check (char_length(interior_number) <= 20),
  neighborhood text check (char_length(neighborhood) <= 120),
  municipality text not null check (char_length(municipality) <= 80),
  city text not null check (char_length(city) <= 80),
  state text not null check (char_length(state) <= 80),
  postal_code text not null check (postal_code ~ '^[0-9]{5}$'),
  country char(2) not null default 'MX',
  references_note text check (char_length(references_note) <= 300),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index addresses_user_idx on public.addresses (user_id);
create trigger addresses_updated_at before update on public.addresses
  for each row execute function public.set_updated_at();

-- Role helpers. SECURITY DEFINER so they can be used inside RLS policies
-- without recursing into the policies of `profiles`.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active'
  );
$$;

-- Create profile rows when somebody signs up through Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text;
  candidate text;
  display text;
begin
  base := lower(regexp_replace(split_part(coalesce(new.email, 'usuario'), '@', 1), '[^a-zA-Z0-9_]', '', 'g'));
  if char_length(base) < 3 then
    base := 'usuario';
  end if;
  base := left(base, 22);
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    candidate := base || '_' || substr(md5(random()::text), 1, 6);
  end loop;

  display := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    base
  );

  insert into public.profiles (id, username, display_name)
  values (new.id, candidate, left(display, 60));

  insert into public.private_profiles (id, email)
  values (new.id, new.email);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Platform settings (commission, concierge threshold, ...). Admin-editable.
-- -----------------------------------------------------------------------------
create table public.platform_settings (
  key text primary key check (key ~ '^[a-z0-9_]+$'),
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
create trigger platform_settings_updated_at before update on public.platform_settings
  for each row execute function public.set_updated_at();

create or replace function public.get_setting(setting_key text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select value from public.platform_settings where key = setting_key;
$$;

-- -----------------------------------------------------------------------------
-- Catalogue: categories (with optional parent = subcategory) and brands
-- -----------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories (id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name text not null check (char_length(name) between 1 and 60),
  icon text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  -- Big items (cribs, furniture) may be restricted to local delivery / pickup.
  allows_shipping boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index categories_parent_idx on public.categories (parent_id);
create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  slug text not null unique check (slug ~ '^[a-z0-9-]{1,60}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Listings
-- -----------------------------------------------------------------------------
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 90),
  description text not null default '' check (char_length(description) <= 4000),
  category_id uuid not null references public.categories (id),
  subcategory_id uuid references public.categories (id),
  brand_id uuid references public.brands (id) on delete set null,
  brand text check (char_length(brand) <= 60),
  model text check (char_length(model) <= 80),
  condition public.listing_condition not null,
  age_stages public.age_stage[] not null default '{}',
  listing_type public.listing_type not null default 'single',
  bundle_item_count integer check (bundle_item_count is null or bundle_item_count between 2 and 500),
  price_cents integer not null check (price_cents between 1000 and 100000000),
  currency char(3) not null default 'MXN',
  -- Approximate location only. Never the exact address.
  city text not null check (char_length(city) between 1 and 80),
  municipality text check (char_length(municipality) <= 80),
  state text check (char_length(state) <= 80),
  delivery_methods public.delivery_method[] not null default '{pickup}',
  shipping_price_cents integer check (shipping_price_cents is null or shipping_price_cents >= 0),
  status public.listing_status not null default 'draft',
  sale_channel public.sale_channel not null default 'self_service',
  rejection_reason text,
  view_count integer not null default 0,
  favorite_count integer not null default 0,
  search_vector tsvector,
  published_at timestamptz,
  sold_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listings_delivery_not_empty check (cardinality(delivery_methods) > 0),
  constraint listings_bundle_count check (listing_type = 'bundle' or bundle_item_count is null)
);
create index listings_seller_idx on public.listings (seller_id, status);
create index listings_status_published_idx on public.listings (status, published_at desc);
create index listings_category_idx on public.listings (category_id, status);
create index listings_price_idx on public.listings (price_cents) where status = 'active';
create index listings_city_idx on public.listings (lower(city)) where status = 'active';
create index listings_age_stages_idx on public.listings using gin (age_stages);
create index listings_delivery_idx on public.listings using gin (delivery_methods);
create index listings_search_idx on public.listings using gin (search_vector);

create trigger listings_updated_at before update on public.listings
  for each row execute function public.set_updated_at();

-- Maintains search_vector from title, brand, model, category and description.
create or replace function public.listings_search_vector()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  category_names text;
begin
  select string_agg(c.name, ' ') into category_names
  from public.categories c
  where c.id in (new.category_id, new.subcategory_id);

  new.search_vector :=
    setweight(to_tsvector('public.es_unaccent', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('public.es_unaccent', coalesce(new.brand, '') || ' ' || coalesce(new.model, '')), 'A') ||
    setweight(to_tsvector('public.es_unaccent', coalesce(category_names, '')), 'B') ||
    setweight(to_tsvector('public.es_unaccent', coalesce(new.description, '')), 'C');
  return new;
end;
$$;

create trigger listings_search_vector_trg
  before insert or update of title, description, brand, model, category_id, subcategory_id
  on public.listings
  for each row execute function public.listings_search_vector();

create table public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  -- Path inside the `listing-images` storage bucket: {seller_id}/{listing_id}/{file}
  storage_path text not null,
  -- 0 is the main photo.
  position smallint not null check (position between 0 and 19),
  width integer,
  height integer,
  created_at timestamptz not null default now(),
  constraint listing_images_position_key unique (listing_id, position) deferrable initially deferred
);

-- -----------------------------------------------------------------------------
-- Favorites and wishlists (saved searches)
-- -----------------------------------------------------------------------------
create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create index favorites_listing_idx on public.favorites (listing_id);

create or replace function public.favorites_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.listings set favorite_count = favorite_count + 1 where id = new.listing_id;
  elsif tg_op = 'DELETE' then
    update public.listings set favorite_count = greatest(favorite_count - 1, 0) where id = old.listing_id;
  end if;
  return null;
end;
$$;
create trigger favorites_count_trg
  after insert or delete on public.favorites
  for each row execute function public.favorites_count();

create table public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text check (char_length(name) <= 80),
  query text check (char_length(query) <= 120),
  category_id uuid references public.categories (id) on delete set null,
  brand text check (char_length(brand) <= 60),
  max_price_cents integer check (max_price_cents is null or max_price_cents > 0),
  city text check (char_length(city) <= 80),
  age_stages public.age_stage[] not null default '{}',
  notify boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index wishlists_user_idx on public.wishlists (user_id);
create trigger wishlists_updated_at before update on public.wishlists
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Concierge ("Véndelo por mí")
-- -----------------------------------------------------------------------------
create table public.concierge_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 90),
  description text not null default '' check (char_length(description) <= 4000),
  category_id uuid references public.categories (id) on delete set null,
  brand text check (char_length(brand) <= 60),
  model text check (char_length(model) <= 80),
  condition public.listing_condition,
  expected_price_cents integer not null check (expected_price_cents > 0),
  city text check (char_length(city) <= 80),
  municipality text check (char_length(municipality) <= 80),
  -- Paths inside the `listing-images` bucket: {user_id}/concierge/{request_id}/{file}
  image_paths text[] not null default '{}',
  status public.concierge_status not null default 'submitted',
  commission_percentage numeric(5,2),
  admin_notes text,
  listing_id uuid references public.listings (id) on delete set null,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index concierge_requests_user_idx on public.concierge_requests (user_id);
create index concierge_requests_status_idx on public.concierge_requests (status, created_at desc);
create trigger concierge_requests_updated_at before update on public.concierge_requests
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Orders, payments, payouts
--   Written exclusively by the server (service role) from checkout and
--   Stripe webhooks. Users only read their own.
-- -----------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles (id),
  seller_id uuid not null references public.profiles (id),
  listing_id uuid not null references public.listings (id),
  status public.order_status not null default 'pending_payment',
  sale_channel public.sale_channel not null default 'self_service',
  delivery_method public.delivery_method not null,
  -- Snapshot of the address at purchase time (only for shipping / local delivery).
  shipping_address jsonb,
  currency char(3) not null default 'MXN',
  -- Money breakdown (all cents). Snapshots, never recomputed from settings.
  item_price_cents integer not null check (item_price_cents >= 0),
  shipping_cents integer not null default 0 check (shipping_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  commission_percentage numeric(5,2) not null,
  platform_commission_cents integer not null check (platform_commission_cents >= 0),
  payment_fee_cents integer not null default 0 check (payment_fee_cents >= 0),
  seller_net_cents integer not null check (seller_net_cents >= 0),
  platform_net_cents integer not null default 0,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  paid_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_buyer_not_seller check (buyer_id <> seller_id),
  constraint orders_total_consistent check (total_cents = item_price_cents + shipping_cents)
);
create index orders_buyer_idx on public.orders (buyer_id, created_at desc);
create index orders_seller_idx on public.orders (seller_id, created_at desc);
create index orders_listing_idx on public.orders (listing_id);
create index orders_status_idx on public.orders (status, created_at desc);
-- A listing can only have one live order at a time.
create unique index orders_one_live_per_listing on public.orders (listing_id)
  where status not in ('cancelled', 'refunded');
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

-- Bundles / multi-item carts later. For the MVP there is one item per order.
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  listing_id uuid references public.listings (id) on delete set null,
  title text not null,
  price_cents integer not null check (price_cents >= 0),
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now()
);
create index order_items_order_idx on public.order_items (order_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  provider text not null default 'stripe',
  stripe_payment_intent_id text unique,
  stripe_charge_id text,
  amount_cents integer not null check (amount_cents >= 0),
  fee_cents integer not null default 0 check (fee_cents >= 0),
  refunded_cents integer not null default 0 check (refunded_cents >= 0),
  currency char(3) not null default 'MXN',
  status public.payment_status not null default 'requires_payment',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_order_idx on public.payments (order_id);
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  seller_id uuid not null references public.profiles (id),
  amount_cents integer not null check (amount_cents >= 0),
  currency char(3) not null default 'MXN',
  stripe_transfer_id text unique,
  status public.payout_status not null default 'pending',
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payouts_seller_idx on public.payouts (seller_id, created_at desc);
create unique index payouts_one_per_order on public.payouts (order_id)
  where status <> 'cancelled';
create trigger payouts_updated_at before update on public.payouts
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Messaging (always tied to a listing)
-- -----------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  constraint conversations_distinct_participants check (buyer_id <> seller_id),
  constraint conversations_listing_buyer_key unique (listing_id, buyer_id)
);
create index conversations_buyer_idx on public.conversations (buyer_id, last_message_at desc);
create index conversations_seller_idx on public.conversations (seller_id, last_message_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

create or replace function public.messages_touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return null;
end;
$$;
create trigger messages_touch_conversation_trg
  after insert on public.messages
  for each row execute function public.messages_touch_conversation();

-- -----------------------------------------------------------------------------
-- Reviews (after a completed order)
-- -----------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  reviewee_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  constraint reviews_one_per_reviewer unique (order_id, reviewer_id),
  constraint reviews_not_self check (reviewer_id <> reviewee_id)
);
create index reviews_reviewee_idx on public.reviews (reviewee_id, created_at desc);

create or replace function public.reviews_update_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := coalesce(new.reviewee_id, old.reviewee_id);
begin
  update public.profiles p
  set rating_avg = s.avg_rating, rating_count = s.cnt
  from (
    select round(avg(rating)::numeric, 2) as avg_rating, count(*)::int as cnt
    from public.reviews where reviewee_id = target
  ) s
  where p.id = target;
  return null;
end;
$$;
create trigger reviews_update_rating_trg
  after insert or update or delete on public.reviews
  for each row execute function public.reviews_update_rating();

-- -----------------------------------------------------------------------------
-- Notifications (in-app; email goes through Resend from the server)
-- -----------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
