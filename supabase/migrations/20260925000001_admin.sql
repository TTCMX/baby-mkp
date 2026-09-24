-- =============================================================================
-- Admin: audit log, dispute resolution fields and marketplace metrics.
-- Admin writes go through the server (service role) after requireAdmin();
-- every one of them is recorded in admin_audit_log.
-- =============================================================================

alter table public.orders
  add column if not exists dispute_resolved_at timestamptz,
  add column if not exists dispute_resolution text check (char_length(dispute_resolution) <= 1000),
  add column if not exists refunded_at timestamptz;

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index admin_audit_log_entity_idx on public.admin_audit_log (entity_type, entity_id, created_at desc);
create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;
-- New tables get Supabase default grants: reset them explicitly.
revoke all on public.admin_audit_log from anon, authenticated;
grant select on public.admin_audit_log to authenticated;
create policy "admins read audit log" on public.admin_audit_log
  for select to authenticated using (public.is_admin());

-- Marketplace KPIs (spec §26). p_since = start of the window (null = all time).
--   GMV            : buyer totals of paid, non-refunded orders
--   revenue        : platform commission of those orders
--   net_revenue    : commission − payment processor fees
--   take_rate      : revenue / GMV
--   sell_through   : sold / (sold + active) listings
--   avg_days_to_sale, avg_ticket
create or replace function public.admin_metrics(p_since timestamptz default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with o as (
    select * from public.orders
    where status in ('paid', 'in_delivery', 'delivered', 'completed')
      and (p_since is null or paid_at >= p_since)
  ),
  l as (
    select
      count(*) filter (where status = 'active') as active,
      count(*) filter (where status = 'sold' and (p_since is null or sold_at >= p_since)) as sold,
      count(*) filter (where status = 'pending_review') as pending_review,
      avg(extract(epoch from (sold_at - published_at)) / 86400)
        filter (where status = 'sold' and published_at is not null and (p_since is null or sold_at >= p_since)) as avg_days
    from public.listings
  )
  select jsonb_build_object(
    'orders', (select count(*) from o),
    'gmv_cents', coalesce((select sum(total_cents) from o), 0),
    'revenue_cents', coalesce((select sum(platform_commission_cents) from o), 0),
    'net_revenue_cents', coalesce((select sum(platform_net_cents) from o), 0),
    'avg_ticket_cents', coalesce((select round(avg(total_cents)) from o), 0),
    'take_rate', case when coalesce((select sum(total_cents) from o), 0) = 0 then 0
                      else round((select sum(platform_commission_cents) from o)::numeric / (select sum(total_cents) from o), 4) end,
    'completed_orders', (select count(*) from o where status = 'completed'),
    'open_disputes', (select count(*) from public.orders where disputed_at is not null and dispute_resolved_at is null),
    'pending_payouts', (select count(*) from public.payouts where status in ('pending', 'failed')),
    'active_listings', (select active from l),
    'sold_listings', (select sold from l),
    'pending_review', (select pending_review from l),
    'sell_through', case when (select active + sold from l) = 0 then 0
                         else round((select sold::numeric / (active + sold) from l), 4) end,
    'avg_days_to_sale', round(coalesce((select avg_days from l), 0)::numeric, 1),
    'new_users', (select count(*) from public.profiles where p_since is null or created_at >= p_since)
  );
$$;

revoke execute on function public.admin_metrics(timestamptz) from public, anon, authenticated;
grant execute on function public.admin_metrics(timestamptz) to service_role;
