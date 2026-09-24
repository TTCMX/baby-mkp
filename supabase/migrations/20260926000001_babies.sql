-- =============================================================================
-- "Crece con tus bebés": a family's babies (or a pregnancy) so the app can
-- follow their stage and show products for it. Private to the parent.
-- Data minimisation: only a first name/nickname and a date — nothing else.
-- =============================================================================

create table public.babies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  -- Exactly one of: birth date (born) or due date (pregnancy).
  birth_date date,
  due_date date,
  color text not null default 'sky' check (color in ('sky', 'pink', 'sun')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint babies_one_date check ((birth_date is null) <> (due_date is null)),
  constraint babies_birth_not_future check (birth_date is null or birth_date <= current_date),
  constraint babies_birth_reasonable check (birth_date is null or birth_date >= date '2005-01-01')
);
create index babies_user_idx on public.babies (user_id, created_at);
create trigger babies_updated_at before update on public.babies
  for each row execute function public.set_updated_at();

-- Keep families reasonable (and the home switcher usable).
create or replace function public.babies_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.babies where user_id = new.user_id) >= 8 then
    raise exception 'too_many_babies' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger babies_limit_trg before insert on public.babies
  for each row execute function public.babies_limit();

-- New tables get Supabase default grants: reset them explicitly.
revoke all on public.babies from anon, authenticated;
grant select, insert, update, delete on public.babies to authenticated;
alter table public.babies enable row level security;

create policy "parents manage their babies" on public.babies
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_active_user());
