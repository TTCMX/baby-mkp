-- Seed data: loaded by `supabase db reset` (local) — run manually in production.

insert into public.platform_settings (key, value, description) values
  ('platform_commission_percentage', '10', 'Comisión de la plataforma (%) en ventas self-service'),
  ('concierge_commission_percentage', '25', 'Comisión de la plataforma (%) en ventas concierge'),
  ('concierge_min_price_cents', '500000', 'Precio mínimo (centavos MXN) para ofrecer "Véndelo por mí"'),
  ('listings_require_review', 'false', 'Si es true, los listings pasan por revisión antes de publicarse'),
  ('max_images_per_listing', '12', 'Número máximo de fotos por listing'),
  ('default_currency', '"MXN"', 'Moneda por defecto')
on conflict (key) do nothing;

insert into public.categories (slug, name, icon, sort_order, allows_shipping) values
  ('carriolas', 'Carriolas', 'baby', 10, true),
  ('sillas-de-auto', 'Sillas de auto', 'car', 20, true),
  ('cunas-y-muebles', 'Cunas y muebles', 'bed', 30, false),
  ('alimentacion', 'Alimentación', 'milk', 40, true),
  ('monitores-y-electronicos', 'Monitores y electrónicos', 'monitor', 50, true),
  ('juguetes', 'Juguetes', 'puzzle', 60, true),
  ('ropa', 'Ropa', 'shirt', 70, true),
  ('accesorios', 'Accesorios', 'backpack', 80, true),
  ('bano-y-cuidado', 'Baño y cuidado', 'bath', 90, true),
  ('otros', 'Otros', 'package', 100, true)
on conflict (slug) do nothing;

insert into public.brands (name, slug) values
  ('Nuna', 'nuna'), ('UPPAbaby', 'uppababy'), ('Bugaboo', 'bugaboo'),
  ('Cybex', 'cybex'), ('Chicco', 'chicco'), ('Graco', 'graco'),
  ('Maxi-Cosi', 'maxi-cosi'), ('Britax', 'britax'), ('Stokke', 'stokke'),
  ('Evenflo', 'evenflo'), ('Fisher-Price', 'fisher-price'), ('Baby Bjorn', 'babybjorn'),
  ('Joie', 'joie'), ('Doona', 'doona'), ('Philips Avent', 'philips-avent'),
  ('Owlet', 'owlet'), ('Nanit', 'nanit'), ('Carter''s', 'carters'),
  ('Zara Kids', 'zara-kids'), ('H&M', 'hm')
on conflict (slug) do nothing;
