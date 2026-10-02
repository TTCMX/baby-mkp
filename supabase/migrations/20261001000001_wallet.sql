-- =============================================================================
-- Balance ("saldo") replaces Stripe Connect payouts.
--
--   buyer pays (card and/or balance) ──▶ platform Stripe account
--   order completed ──▶ seller's balance += seller_net
--   balance ──▶ spend at checkout, or withdraw to a CLABE (paid by SPEI on Tuesday)
--
-- Every movement is a row in wallet_entries (append-only ledger); wallets keeps
-- the running balance so it can be locked and checked in one place. Balance only
-- comes from sales and refunds: it can't be topped up or sent to another user.
-- =============================================================================

-- --------------------------------------------------------------------- ledger
create type public.wallet_entry_kind as enum (
  'sale',                -- + seller_net when an order completes
  'sale_reversal',       -- − seller_net when a completed order is refunded
  'purchase',            -- − balance applied at checkout
  'purchase_release',    -- + balance given back when that checkout is cancelled
  'refund',              -- + balance part of a refunded purchase
  'withdrawal',          -- − amount requested to the bank
  'withdrawal_reversal', -- + a withdrawal that could not be paid
  'adjustment'           -- ± manual correction by an admin
);

create table public.wallets (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  -- Can only go negative through a sale reversal (seller already spent it):
  -- spending and withdrawing always check for enough balance.
  balance_cents integer not null default 0,
  currency char(3) not null default 'MXN',
  updated_at timestamptz not null default now()
);

create table public.wallet_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.wallet_entry_kind not null,
  amount_cents integer not null check (amount_cents <> 0),
  balance_after_cents integer not null,
  order_id uuid references public.orders (id) on delete set null,
  withdrawal_id uuid,
  note text check (char_length(note) <= 500),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);
create index wallet_entries_user_idx on public.wallet_entries (user_id, created_at desc);
-- Idempotency: each order / withdrawal event is booked once.
create unique index wallet_entries_once_per_order on public.wallet_entries (kind, order_id, user_id)
  where order_id is not null and kind <> 'adjustment';
create unique index wallet_entries_once_per_withdrawal on public.wallet_entries (kind, withdrawal_id)
  where withdrawal_id is not null;

-- --------------------------------------------------------------- bank account
-- CLABE: 18 digits, last one is a check digit (weights 3,7,1).
create or replace function public.is_valid_clabe(p text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p ~ '^[0-9]{18}$' and (
    (10 - (
      select sum((substr(p, i, 1)::int * (array[3, 7, 1])[((i - 1) % 3) + 1]) % 10)
      from generate_series(1, 17) i
    ) % 10) % 10
  ) = substr(p, 18, 1)::int;
$$;

create table public.bank_accounts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  clabe char(18) not null check (public.is_valid_clabe(clabe)),
  holder_name text not null check (char_length(trim(holder_name)) between 3 and 120),
  bank_name text not null check (char_length(trim(bank_name)) between 2 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger bank_accounts_updated_at before update on public.bank_accounts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- withdrawals
create type public.withdrawal_status as enum ('requested', 'paid', 'failed');

create table public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  currency char(3) not null default 'MXN',
  status public.withdrawal_status not null default 'requested',
  payout_date date not null,
  -- Snapshot of where the money goes, as it was when requested.
  clabe char(18) not null,
  holder_name text not null,
  bank_name text not null,
  reference text check (char_length(reference) <= 100),
  failure_reason text check (char_length(failure_reason) <= 500),
  processed_by uuid references public.profiles (id),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index withdrawals_user_idx on public.withdrawals (user_id, created_at desc);
create index withdrawals_payout_idx on public.withdrawals (payout_date, status);
create trigger withdrawals_updated_at before update on public.withdrawals
  for each row execute function public.set_updated_at();
alter table public.wallet_entries
  add constraint wallet_entries_withdrawal_fk foreign key (withdrawal_id) references public.withdrawals (id) on delete set null;

-- Orders remember how much of the total was paid with balance.
alter table public.orders
  add column if not exists balance_applied_cents integer not null default 0 check (balance_applied_cents >= 0),
  add constraint orders_balance_within_total check (balance_applied_cents <= total_cents);

insert into public.platform_settings (key, value, description) values
  ('withdrawal_min_cents', '0', 'Monto mínimo para retirar saldo, en centavos (0 = sin mínimo)')
on conflict (key) do nothing;

-- ----------------------------------------------------------------------- RLS
alter table public.wallets enable row level security;
alter table public.wallet_entries enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.withdrawals enable row level security;

revoke all on public.wallets, public.wallet_entries, public.bank_accounts, public.withdrawals from anon, authenticated;
grant select on public.wallets, public.wallet_entries, public.withdrawals to authenticated;
grant select, insert, update, delete on public.bank_accounts to authenticated;
grant all on public.wallets, public.wallet_entries, public.bank_accounts, public.withdrawals to service_role;

create policy "owner or admin reads wallet" on public.wallets
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "owner or admin reads wallet entries" on public.wallet_entries
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "owner or admin reads withdrawals" on public.withdrawals
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "owner or admin reads bank account" on public.bank_accounts
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "owner saves bank account" on public.bank_accounts
  for insert to authenticated with check (user_id = auth.uid() and public.is_active_user());
create policy "owner updates bank account" on public.bank_accounts
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_active_user());
create policy "owner removes bank account" on public.bank_accounts
  for delete to authenticated using (user_id = auth.uid());

-- ------------------------------------------------------------------ internals
-- Books one movement and returns the new balance. With p_require_funds, a
-- debit that would leave the balance negative fails with 'insufficient_balance'.
-- Idempotent: a duplicate (same kind + order / withdrawal) is ignored.
create or replace function public.wallet_post(
  p_user uuid,
  p_kind public.wallet_entry_kind,
  p_amount integer,
  p_order uuid default null,
  p_withdrawal uuid default null,
  p_note text default null,
  p_require_funds boolean default false,
  p_created_by uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  bal integer;
begin
  if p_amount = 0 then
    return (select balance_cents from public.wallets where user_id = p_user);
  end if;
  if p_kind <> 'adjustment' and (
    (p_order is not null and exists (
      select 1 from public.wallet_entries where kind = p_kind and order_id = p_order and user_id = p_user))
    or (p_withdrawal is not null and exists (
      select 1 from public.wallet_entries where kind = p_kind and withdrawal_id = p_withdrawal))
  ) then
    return (select balance_cents from public.wallets where user_id = p_user);
  end if;

  insert into public.wallets (user_id) values (p_user) on conflict (user_id) do nothing;
  select balance_cents into bal from public.wallets where user_id = p_user for update;
  if p_require_funds and p_amount < 0 and bal + p_amount < 0 then
    raise exception 'insufficient_balance' using errcode = '22023';
  end if;

  update public.wallets set balance_cents = bal + p_amount, updated_at = now() where user_id = p_user;
  insert into public.wallet_entries (user_id, kind, amount_cents, balance_after_cents, order_id, withdrawal_id, note, created_by)
  values (p_user, p_kind, p_amount, bal + p_amount, p_order, p_withdrawal, p_note, p_created_by);
  return bal + p_amount;
end;
$$;

-- Tuesday the money arrives: requests up to Friday 23:59 (Mexico City) are paid
-- the following Tuesday; Saturday onwards, the Tuesday after the next Friday.
create or replace function public.withdrawal_payout_date(p_at timestamptz default now())
returns date
language sql
stable
set search_path = ''
as $$
  with d as (select (p_at at time zone 'America/Mexico_City')::date as day)
  select day + ((5 - extract(isodow from day)::int + 7) % 7) + 4 from d;
$$;

-- Effects of an order becoming paid (shared by card and full-balance payments).
create or replace function public.order_paid_effects(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = p_order_id;
  update public.listings set status = 'sold', sold_at = now() where id = o.listing_id;
  insert into public.notifications (user_id, type, title, body, link, data) values
    (o.seller_id, 'order_paid_seller', '¡Vendiste un producto!',
     'El comprador ya pagó. Revisa los detalles de la entrega.', '/orders/' || o.id, jsonb_build_object('order_id', o.id)),
    (o.buyer_id, 'order_paid_buyer', 'Pago confirmado',
     'Tu compra está confirmada. El vendedor preparará la entrega.', '/orders/' || o.id, jsonb_build_object('order_id', o.id));
end;
$$;

-- -------------------------------------------------------------- order money
-- Completed order → seller's balance (once, whichever path completed it).
create or replace function public.orders_credit_seller()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' and new.seller_net_cents > 0 then
    perform public.wallet_post(new.seller_id, 'sale', new.seller_net_cents, new.id, null, null);
    insert into public.notifications (user_id, type, title, body, link, data)
    values (new.seller_id, 'balance_credited', 'Tienes saldo nuevo',
      'Agregamos el dinero de tu venta a tu saldo. Úsalo para comprar o retíralo a tu cuenta.',
      '/balance', jsonb_build_object('order_id', new.id));
  end if;
  return null;
end;
$$;
create trigger orders_credit_seller_trg
  after update of status on public.orders
  for each row execute function public.orders_credit_seller();

create or replace function public.cancel_pending_order(p_order_id uuid, p_reason text default 'payment_not_completed')
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
begin
  update public.orders
  set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason
  where id = p_order_id and status = 'pending_payment'
  returning * into o;
  if not found then
    return false;
  end if;

  update public.listings
  set status = 'active'
  where id = o.listing_id and status = 'reserved';

  update public.payments set status = 'failed'
  where order_id = o.id and status in ('requires_payment', 'processing');

  -- Give back the balance the buyer had applied.
  if o.balance_applied_cents > 0 then
    perform public.wallet_post(o.buyer_id, 'purchase_release', o.balance_applied_cents, o.id, null, null);
  end if;
  return true;
end;
$$;

drop function if exists public.create_checkout_order(uuid, uuid, public.delivery_method, jsonb, integer, integer, numeric, integer, integer);
create or replace function public.create_checkout_order(
  p_listing_id uuid,
  p_buyer_id uuid,
  p_delivery_method public.delivery_method,
  p_shipping_address jsonb,
  p_item_price_cents integer,
  p_shipping_cents integer,
  p_commission_percentage numeric,
  p_platform_commission_cents integer,
  p_seller_net_cents integer,
  p_balance_cents integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.listings;
  stale uuid;
  new_order uuid;
  total integer := p_item_price_cents + p_shipping_cents;
begin
  select * into l from public.listings where id = p_listing_id for update;
  if not found then
    raise exception 'listing_not_found' using errcode = 'P0002';
  end if;

  -- Release abandoned checkouts that never got a Stripe "expired" event.
  if l.status = 'reserved' then
    select id into stale from public.orders
    where listing_id = l.id and status = 'pending_payment' and created_at < now() - interval '35 minutes';
    if stale is not null then
      perform public.cancel_pending_order(stale, 'checkout_abandoned');
      l.status := 'active';
    end if;
  end if;

  if l.status <> 'active' then
    raise exception 'listing_unavailable' using errcode = '22023';
  end if;
  if l.seller_id = p_buyer_id then
    raise exception 'own_listing' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_buyer_id and status = 'active') then
    raise exception 'buyer_not_allowed' using errcode = '42501';
  end if;
  if not (p_delivery_method = any (l.delivery_methods)) then
    raise exception 'delivery_not_offered' using errcode = '22023';
  end if;
  if p_item_price_cents <> l.price_cents then
    raise exception 'price_changed' using errcode = '22023';
  end if;
  if p_shipping_cents <> (case when p_delivery_method = 'shipping' then coalesce(l.shipping_price_cents, 0) else 0 end) then
    raise exception 'shipping_changed' using errcode = '22023';
  end if;
  if p_delivery_method in ('shipping', 'local_delivery') and p_shipping_address is null then
    raise exception 'address_required' using errcode = '22023';
  end if;
  if p_platform_commission_cents < 0 or p_platform_commission_cents > p_item_price_cents
     or p_seller_net_cents <> p_item_price_cents - p_platform_commission_cents + p_shipping_cents then
    raise exception 'invalid_amounts' using errcode = '22023';
  end if;
  if p_balance_cents < 0 or p_balance_cents > total then
    raise exception 'invalid_amounts' using errcode = '22023';
  end if;

  insert into public.orders (
    buyer_id, seller_id, listing_id, status, sale_channel, delivery_method, shipping_address,
    item_price_cents, shipping_cents, total_cents, commission_percentage,
    platform_commission_cents, seller_net_cents, platform_net_cents, balance_applied_cents
  ) values (
    p_buyer_id, l.seller_id, l.id, 'pending_payment', l.sale_channel, p_delivery_method,
    case when p_delivery_method = 'pickup' then null else p_shipping_address end,
    p_item_price_cents, p_shipping_cents, total, p_commission_percentage,
    p_platform_commission_cents, p_seller_net_cents, p_platform_commission_cents, p_balance_cents
  ) returning id into new_order;

  insert into public.order_items (order_id, listing_id, title, price_cents)
  values (new_order, l.id, l.title, p_item_price_cents);

  -- Take the balance now (fails the whole checkout if it isn't there).
  if p_balance_cents > 0 then
    perform public.wallet_post(p_buyer_id, 'purchase', -p_balance_cents, new_order, null, null, true);
  end if;

  if p_balance_cents = total then
    -- Fully paid with balance: no card payment needed.
    update public.orders set status = 'paid', paid_at = now(), payment_fee_cents = 0 where id = new_order;
    insert into public.payments (order_id, provider, amount_cents, fee_cents, status, currency)
    values (new_order, 'balance', total, 0, 'succeeded', 'MXN');
    perform public.order_paid_effects(new_order);
  else
    update public.listings set status = 'reserved' where id = l.id;
  end if;
  return new_order;
end;
$$;

-- Idempotent card payment confirmation from the Stripe webhook. The card pays
-- the total minus the balance applied at checkout.
create or replace function public.mark_order_paid(
  p_order_id uuid,
  p_payment_intent_id text,
  p_charge_id text,
  p_amount_cents integer,
  p_fee_cents integer
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if o.status <> 'pending_payment' then
    return case when o.stripe_payment_intent_id = p_payment_intent_id then 'already_paid' else 'needs_refund' end;
  end if;
  if p_amount_cents <> o.total_cents - o.balance_applied_cents then
    raise exception 'amount_mismatch' using errcode = '22023';
  end if;

  update public.orders
  set status = 'paid',
      paid_at = now(),
      stripe_payment_intent_id = p_payment_intent_id,
      payment_fee_cents = p_fee_cents,
      platform_net_cents = platform_commission_cents - p_fee_cents
  where id = o.id;

  insert into public.payments (order_id, stripe_payment_intent_id, stripe_charge_id, amount_cents, fee_cents, status, currency)
  values (o.id, p_payment_intent_id, p_charge_id, p_amount_cents, p_fee_cents, 'succeeded', o.currency)
  on conflict (stripe_payment_intent_id) do update
    set status = 'succeeded', stripe_charge_id = excluded.stripe_charge_id, fee_cents = excluded.fee_cents;

  perform public.order_paid_effects(o.id);
  return 'paid';
end;
$$;

-- Refund bookkeeping on balances: the buyer gets back the part paid with
-- balance, and the seller loses the sale if it was already credited. The card
-- part is refunded through Stripe by the server.
create or replace function public.refund_order_balances(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if o.balance_applied_cents > 0 then
    perform public.wallet_post(o.buyer_id, 'refund', o.balance_applied_cents, o.id, null, null);
  end if;
  if exists (select 1 from public.wallet_entries where kind = 'sale' and order_id = o.id and user_id = o.seller_id) then
    perform public.wallet_post(o.seller_id, 'sale_reversal', -o.seller_net_cents, o.id, null, 'Pedido reembolsado');
  end if;
end;
$$;

-- ---------------------------------------------------------------- withdrawals
-- Seller asks for (part of) their balance; it's paid by SPEI on payout_date.
create or replace function public.request_withdrawal(p_amount_cents integer)
returns public.withdrawals
language plpgsql
security definer
set search_path = ''
as $$
declare
  acct public.bank_accounts;
  w public.withdrawals;
  min_cents integer := coalesce((public.get_setting('withdrawal_min_cents'))::int, 0);
begin
  if not public.is_active_user() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents < min_cents then
    raise exception 'amount_too_small' using errcode = '22023';
  end if;
  select * into acct from public.bank_accounts where user_id = auth.uid();
  if not found then
    raise exception 'bank_account_required' using errcode = '22023';
  end if;

  insert into public.withdrawals (user_id, amount_cents, payout_date, clabe, holder_name, bank_name)
  values (auth.uid(), p_amount_cents, public.withdrawal_payout_date(), acct.clabe, acct.holder_name, acct.bank_name)
  returning * into w;
  perform public.wallet_post(auth.uid(), 'withdrawal', -p_amount_cents, null, w.id, null, true);
  return w;
end;
$$;

-- Admin (through the server, service role): the transfer went out, or it bounced.
create or replace function public.settle_withdrawal(
  p_withdrawal_id uuid,
  p_paid boolean,
  p_admin uuid,
  p_reference text default null,
  p_reason text default null
)
returns public.withdrawals
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.withdrawals;
begin
  update public.withdrawals
  set status = case when p_paid then 'paid'::public.withdrawal_status else 'failed'::public.withdrawal_status end,
      reference = nullif(trim(p_reference), ''),
      failure_reason = case when p_paid then null else nullif(trim(p_reason), '') end,
      processed_by = p_admin,
      processed_at = now()
  where id = p_withdrawal_id and status = 'requested'
  returning * into w;
  if not found then
    raise exception 'invalid_transition' using errcode = '22023';
  end if;

  if p_paid then
    insert into public.notifications (user_id, type, title, body, link, data)
    values (w.user_id, 'withdrawal_paid', 'Te enviamos tu dinero',
      'Tu retiro ya salió por SPEI a tu cuenta.', '/balance', jsonb_build_object('withdrawal_id', w.id));
  else
    perform public.wallet_post(w.user_id, 'withdrawal_reversal', w.amount_cents, null, w.id, p_reason);
    insert into public.notifications (user_id, type, title, body, link, data)
    values (w.user_id, 'withdrawal_failed', 'No pudimos enviar tu retiro',
      'Regresamos el monto a tu saldo. Revisa tu CLABE y vuelve a solicitarlo.', '/balance',
      jsonb_build_object('withdrawal_id', w.id));
  end if;
  return w;
end;
$$;

-- ------------------------------------------------------------------- metrics
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
    'pending_withdrawals', (select count(*) from public.withdrawals where status = 'requested'),
    'pending_withdrawals_cents', coalesce((select sum(amount_cents) from public.withdrawals where status = 'requested'), 0),
    'balances_cents', coalesce((select sum(balance_cents) from public.wallets), 0),
    'active_listings', (select active from l),
    'sold_listings', (select sold from l),
    'pending_review', (select pending_review from l),
    'sell_through', case when (select active + sold from l) = 0 then 0
                         else round((select sold::numeric / (active + sold) from l), 4) end,
    'avg_days_to_sale', round(coalesce((select avg_days from l), 0)::numeric, 1),
    'new_users', (select count(*) from public.profiles where p_since is null or created_at >= p_since)
  );
$$;

-- -------------------------------------------------- move existing payouts over
-- Completed orders whose seller was never paid through Stripe Connect: credit
-- the balance instead and close the old payout row.
do $$
declare
  r record;
begin
  for r in
    select o.id, o.seller_id, o.seller_net_cents
    from public.orders o
    where o.status = 'completed' and o.seller_net_cents > 0
      and not exists (select 1 from public.payouts p where p.order_id = o.id and p.status in ('paid', 'in_transit'))
  loop
    perform public.wallet_post(r.seller_id, 'sale', r.seller_net_cents, r.id, null, 'Venta anterior al saldo');
  end loop;
  update public.payouts set status = 'cancelled' where status in ('pending', 'failed');
end $$;

-- ------------------------------------------------------------------- grants
revoke execute on function public.wallet_post(uuid, public.wallet_entry_kind, integer, uuid, uuid, text, boolean, uuid) from public, anon, authenticated;
revoke execute on function public.order_paid_effects(uuid) from public, anon, authenticated;
revoke execute on function public.orders_credit_seller() from public, anon, authenticated;
revoke execute on function public.cancel_pending_order(uuid, text) from public, anon, authenticated;
revoke execute on function public.create_checkout_order(uuid, uuid, public.delivery_method, jsonb, integer, integer, numeric, integer, integer, integer) from public, anon, authenticated;
revoke execute on function public.mark_order_paid(uuid, text, text, integer, integer) from public, anon, authenticated;
revoke execute on function public.refund_order_balances(uuid) from public, anon, authenticated;
revoke execute on function public.settle_withdrawal(uuid, boolean, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.request_withdrawal(integer) from public, anon;
revoke execute on function public.admin_metrics(timestamptz) from public, anon, authenticated;
grant execute on function public.request_withdrawal(integer) to authenticated;
grant execute on function public.wallet_post(uuid, public.wallet_entry_kind, integer, uuid, uuid, text, boolean, uuid) to service_role;
grant execute on function public.cancel_pending_order(uuid, text) to service_role;
grant execute on function public.create_checkout_order(uuid, uuid, public.delivery_method, jsonb, integer, integer, numeric, integer, integer, integer) to service_role;
grant execute on function public.mark_order_paid(uuid, text, text, integer, integer) to service_role;
grant execute on function public.refund_order_balances(uuid) to service_role;
grant execute on function public.settle_withdrawal(uuid, boolean, uuid, text, text) to service_role;
grant execute on function public.admin_metrics(timestamptz) to service_role;
