-- Zapatos: its own top-level category, next to Ropa.
insert into public.categories (slug, name, icon, sort_order, allows_shipping) values
  ('zapatos', 'Zapatos', 'footprints', 75, true)
on conflict (slug) do nothing;
