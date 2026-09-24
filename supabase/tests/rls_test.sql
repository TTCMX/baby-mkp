-- RLS / business-rule smoke tests. Runs inside a transaction and rolls back.
-- Executed by scripts/db/test.sh (plain PostgreSQL + Supabase stubs).
begin;

-- Test helpers ---------------------------------------------------------------
create function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'ASSERTION FAILED: %', msg; end if;
end $$;
-- Runs `stmt` and asserts it raises an error whose message contains `expected`.
create function pg_temp.expect_error(stmt text, expected text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if position(expected in sqlerrm) = 0 then
      raise exception 'expected error "%" but got "%" for: %', expected, sqlerrm, stmt;
    end if;
    return;
  end;
  raise exception 'expected error "%" but statement succeeded: %', expected, stmt;
end $$;
grant execute on all functions in schema pg_temp to anon, authenticated;

-- Fixtures (as superuser) -----------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com', '{"display_name":"Alice"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com', '{}'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.com', '{}'),
  ('00000000-0000-0000-0000-00000000000c', 'a@example.com', '{}');

select pg_temp.assert((select username from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 'alice', 'username from email');
select pg_temp.assert((select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 'Alice', 'display name from metadata');
select pg_temp.assert((select username from public.profiles where id = '00000000-0000-0000-0000-00000000000c') = 'usuario', 'short email falls back to usuario');
select pg_temp.assert((select email from public.private_profiles where id = '00000000-0000-0000-0000-00000000000b') = 'bob@example.com', 'private profile created');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000ad';
update public.profiles set status = 'suspended' where id = '00000000-0000-0000-0000-00000000000c';

-- Alice sells ----------------------------------------------------------------
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');

insert into public.listings (id, seller_id, title, description, category_id, brand, model, condition, age_stages, price_cents, city, delivery_methods)
select '10000000-0000-0000-0000-000000000001', auth.uid(), 'Carriola Nuna Mixx 2024', 'Usada 8 meses, un rayón pequeño', id, 'Nuna', 'Mixx', 'excellent', '{0_3m,3_6m}', 450000, 'Ciudad de México', '{pickup,shipping}'
from public.categories where slug = 'carriolas';

select pg_temp.expect_error($$insert into public.listings (seller_id, title, category_id, condition, price_cents, city, status)
  select auth.uid(), 'Hack', id, 'good', 10000, 'CDMX', 'active' from public.categories limit 1$$, 'permission denied');
select pg_temp.expect_error($$insert into public.listings (seller_id, title, category_id, condition, price_cents, city)
  select '00000000-0000-0000-0000-00000000000b', 'Impersonate', id, 'good', 10000, 'CDMX' from public.categories limit 1$$, 'row-level security');
select pg_temp.expect_error($$update public.listings set status = 'active' where id = '10000000-0000-0000-0000-000000000001'$$, 'permission denied');
select pg_temp.expect_error($$update public.listings set view_count = 999$$, 'permission denied');
select pg_temp.expect_error($$update public.profiles set role = 'admin' where id = auth.uid()$$, 'permission denied');
select pg_temp.expect_error($$update public.private_profiles set stripe_account_id = 'acct_x'$$, 'permission denied');
select pg_temp.expect_error($$select public.publish_listing('10000000-0000-0000-0000-000000000001')$$, 'missing_images');
select pg_temp.expect_error($$insert into public.listing_images (listing_id, storage_path, position)
  values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b/x.jpg', 0)$$, 'row-level security');

insert into public.listing_images (listing_id, storage_path, position)
values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a/10000000-0000-0000-0000-000000000001/1.jpg', 0);
select pg_temp.assert(public.publish_listing('10000000-0000-0000-0000-000000000001') = 'active', 'publish -> active');
select pg_temp.assert((select published_at is not null from public.listings where id = '10000000-0000-0000-0000-000000000001'), 'published_at set');

-- Atomic photo replacement: reorder + change main photo
select public.replace_listing_images('10000000-0000-0000-0000-000000000001', '[
  {"storage_path":"00000000-0000-0000-0000-00000000000a/10000000-0000-0000-0000-000000000001/b.webp","width":1200,"height":1600},
  {"storage_path":"00000000-0000-0000-0000-00000000000a/10000000-0000-0000-0000-000000000001/a.webp","width":1600,"height":1200}
]'::jsonb);
select pg_temp.assert((select storage_path from public.listing_images where listing_id = '10000000-0000-0000-0000-000000000001' and position = 0) like '%/b.webp', 'main photo replaced');
select pg_temp.assert((select count(*) from public.listing_images where listing_id = '10000000-0000-0000-0000-000000000001') = 2, 'two photos');
select pg_temp.expect_error($$select public.replace_listing_images('10000000-0000-0000-0000-000000000001', '[]'::jsonb)$$, 'missing_images');
select pg_temp.expect_error($$select public.replace_listing_images('10000000-0000-0000-0000-000000000001',
  (select jsonb_agg(jsonb_build_object('storage_path', '00000000-0000-0000-0000-00000000000a/x/' || i || '.webp')) from generate_series(1, 13) i))$$, 'too_many_images');

-- Draft that must stay private
insert into public.listings (id, seller_id, title, category_id, condition, age_stages, price_cents, city)
select '10000000-0000-0000-0000-000000000002', auth.uid(), 'Cuna de madera', id, 'good', '{0_3m}', 300000, 'Puebla'
from public.categories where slug = 'cunas-y-muebles';
update public.listings set delivery_methods = '{shipping}' where id = '10000000-0000-0000-0000-000000000002';
insert into public.listing_images (listing_id, storage_path, position)
values ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a/10000000-0000-0000-0000-000000000002/1.jpg', 0);
select pg_temp.expect_error($$select public.publish_listing('10000000-0000-0000-0000-000000000002')$$, 'shipping_not_allowed');

-- Anonymous visitor ------------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claims', '', true);
select pg_temp.assert((select count(*) from public.listings) = 1, 'anon sees only the active listing');
select pg_temp.assert((select count(*) from public.listing_images) = 2, 'anon sees only images of visible listings');
select pg_temp.expect_error($$select * from public.private_profiles$$, 'permission denied');
select pg_temp.expect_error($$select * from public.orders$$, 'permission denied');
select pg_temp.expect_error($$insert into public.favorites (user_id, listing_id) values ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001')$$, 'permission denied');
select public.record_listing_view('10000000-0000-0000-0000-000000000001');

-- Full-text search (accent-insensitive, Spanish stemming)
select pg_temp.assert((select count(*) from public.listings where search_vector @@ websearch_to_tsquery('public.es_unaccent', 'nuna')) = 1, 'search by brand');
select pg_temp.assert((select count(*) from public.listings where search_vector @@ websearch_to_tsquery('public.es_unaccent', 'carriolas')) = 1, 'search plural');
select pg_temp.assert((select count(*) from public.listings where search_vector @@ websearch_to_tsquery('public.es_unaccent', 'rayon')) = 1, 'search without accent');

-- Bob buys ---------------------------------------------------------------------
reset role;
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert((select view_count from public.listings where id = '10000000-0000-0000-0000-000000000001') = 1, 'view counted');
select pg_temp.assert((select count(*) from public.listings) = 1, 'bob cannot see alice draft');
select pg_temp.assert((select count(*) from public.private_profiles) = 1, 'bob sees only own private profile');

update public.listings set title = 'hijacked' where id = '10000000-0000-0000-0000-000000000001';
select pg_temp.assert((select title from public.listings where id = '10000000-0000-0000-0000-000000000001') <> 'hijacked', 'bob cannot edit alice listing');
select pg_temp.expect_error($$select public.unpublish_listing('10000000-0000-0000-0000-000000000001')$$, 'listing_not_found');

select pg_temp.expect_error($$select public.replace_listing_images('10000000-0000-0000-0000-000000000001',
  '[{"storage_path":"00000000-0000-0000-0000-00000000000b/hack.webp"}]'::jsonb)$$, 'row-level security');
select pg_temp.assert((select count(*) from public.listing_images where listing_id = '10000000-0000-0000-0000-000000000001') = 2, 'bob did not delete alice photos');

insert into public.favorites (user_id, listing_id) values (auth.uid(), '10000000-0000-0000-0000-000000000001');
select pg_temp.assert((select favorite_count from public.listings where id = '10000000-0000-0000-0000-000000000001') = 1, 'favorite counted');
select pg_temp.expect_error($$insert into public.favorites (user_id, listing_id) values (auth.uid(), '10000000-0000-0000-0000-000000000002')$$, 'row-level security');

insert into public.conversations (id, listing_id, buyer_id, seller_id)
values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', auth.uid(), '00000000-0000-0000-0000-00000000000a');
insert into public.messages (conversation_id, sender_id, body)
values ('20000000-0000-0000-0000-000000000001', auth.uid(), '¿Sigue disponible?');
select pg_temp.expect_error($$insert into public.messages (conversation_id, sender_id, body)
  values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'spoof')$$, 'row-level security');
select pg_temp.expect_error($$insert into public.orders (buyer_id, seller_id, listing_id, delivery_method, item_price_cents, total_cents, commission_percentage, platform_commission_cents, seller_net_cents)
  values (auth.uid(), '00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 'pickup', 1, 1, 10, 0, 1)$$, 'permission denied');

-- Alice reads the message, marks it read
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
update public.messages set read_at = now() where conversation_id = '20000000-0000-0000-0000-000000000001';
select pg_temp.assert((select read_at is not null from public.messages limit 1), 'recipient marks read');
select pg_temp.expect_error($$update public.messages set body = 'edited'$$, 'permission denied');

-- Server (service role) creates and completes the order -----------------------
reset role;
insert into public.orders (id, buyer_id, seller_id, listing_id, delivery_method, item_price_cents, total_cents,
  commission_percentage, platform_commission_cents, seller_net_cents, status)
values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a',
  '10000000-0000-0000-0000-000000000001', 'pickup', 450000, 450000, 10, 45000, 405000, 'paid');
select pg_temp.expect_error($$insert into public.orders (buyer_id, seller_id, listing_id, delivery_method, item_price_cents, total_cents,
  commission_percentage, platform_commission_cents, seller_net_cents)
  values ('00000000-0000-0000-0000-0000000000ad', '00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 'pickup', 1, 1, 10, 0, 1)$$,
  'orders_one_live_per_listing');
update public.orders set status = 'completed', completed_at = now() where id = '30000000-0000-0000-0000-000000000001';
select pg_temp.assert((select sales_count from public.profiles where username = 'alice') = 1, 'sales counter');

-- Reviews ----------------------------------------------------------------------
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert((select count(*) from public.orders) = 1, 'buyer sees own order');
insert into public.reviews (order_id, reviewer_id, reviewee_id, rating, comment)
values ('30000000-0000-0000-0000-000000000001', auth.uid(), '00000000-0000-0000-0000-00000000000a', 5, 'Todo perfecto');
select pg_temp.assert((select rating_avg from public.profiles where username = 'alice') = 5.00, 'rating updated');
select pg_temp.expect_error($$insert into public.reviews (order_id, reviewer_id, reviewee_id, rating)
  values ('30000000-0000-0000-0000-000000000001', auth.uid(), '00000000-0000-0000-0000-00000000000a', 1)$$, 'reviews_one_per_reviewer');

-- Admin ------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000ad');
select pg_temp.assert((select count(*) from public.private_profiles) = 4, 'admin reads private profiles');
select pg_temp.assert((select count(*) from public.listings) = 2, 'admin sees drafts');
update public.platform_settings set value = '12' where key = 'platform_commission_percentage';
select pg_temp.assert(public.get_setting('platform_commission_percentage') = '12'::jsonb, 'admin updates settings');

-- Non-admin cannot change settings / categories
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
update public.platform_settings set value = '0' where key = 'platform_commission_percentage';
select pg_temp.assert(public.get_setting('platform_commission_percentage') = '12'::jsonb, 'user cannot update settings');
select pg_temp.expect_error($$insert into public.categories (slug, name) values ('hack', 'Hack')$$, 'row-level security');

-- Suspended user cannot sell --------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select pg_temp.expect_error($$insert into public.listings (seller_id, title, category_id, condition, price_cents, city)
  select auth.uid(), 'Suspended', id, 'good', 10000, 'CDMX' from public.categories limit 1$$, 'row-level security');

reset role;
rollback;
