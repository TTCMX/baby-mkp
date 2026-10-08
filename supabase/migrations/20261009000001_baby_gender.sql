-- Baby's gender: personalises their feed (her items + unisex + items without
-- gender). Null = "Todos" (not known yet, or the parent prefers all).
alter table public.babies
  add column if not exists gender text check (gender in ('girl', 'boy'));
