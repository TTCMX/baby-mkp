-- =============================================================================
-- Managed sellers: profiles of people who never log in. Their products are
-- imported in bulk and kept in the platform's warehouse; admins run their
-- sales (ship / deliver), see their balance and request their withdrawals.
-- =============================================================================

alter table public.profiles
  add column if not exists is_managed boolean not null default false;

-- The real person behind a managed profile (private: owner or admin only).
alter table public.private_profiles
  add column if not exists owner_name text check (char_length(owner_name) <= 120),
  add column if not exists owner_email text check (char_length(owner_email) <= 200),
  -- The person's id in the source spreadsheet ("vendedor_id"): re-imports find the same profile.
  add column if not exists owner_key text check (char_length(owner_key) <= 100);
create unique index if not exists private_profiles_owner_key on public.private_profiles (owner_key)
  where owner_key is not null;

-- Where an imported photo came from: re-imports skip photos that didn't change.
alter table public.listing_images
  add column if not exists source_url text check (char_length(source_url) <= 2000);

-- Id of the product in the source spreadsheet: re-importing the same file
-- updates instead of duplicating.
alter table public.listings
  add column if not exists external_ref text check (char_length(external_ref) <= 100);
create unique index if not exists listings_external_ref_key on public.listings (external_ref)
  where external_ref is not null;

-- What buyers of managed products see as the seller's contact (the warehouse).
insert into public.platform_settings (key, value, description) values
  ('managed_contact_email', '""', 'Correo de contacto para compradores de productos gestionados (bodega)'),
  ('managed_contact_phone', '""', 'Teléfono de contacto para compradores de productos gestionados (bodega)')
on conflict (key) do nothing;

-- The seller themself, or an admin acting for a managed seller.
create or replace function public.can_act_for_seller(p_seller uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_seller = auth.uid()
    or (public.is_admin() and exists (select 1 from public.profiles where id = p_seller and is_managed));
$$;

create or replace function public.order_mark_shipped(p_order_id uuid, p_carrier text, p_tracking text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
begin
  update public.orders
  set status = 'in_delivery', shipped_at = now(),
      tracking_carrier = nullif(trim(p_carrier), ''), tracking_number = nullif(trim(p_tracking), '')
  where id = p_order_id and public.can_act_for_seller(seller_id) and status = 'paid' and disputed_at is null
  returning * into o;
  if not found then
    raise exception 'invalid_transition' using errcode = '22023';
  end if;
  perform public.notify(o.buyer_id, 'order_shipped', 'Tu pedido va en camino',
    coalesce('Guía: ' || o.tracking_carrier || ' ' || o.tracking_number, 'El vendedor ya lo envió.'), o.id);
end;
$$;

create or replace function public.order_mark_delivered(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
  days int := coalesce((public.get_setting('order_auto_complete_days'))::int, 3);
begin
  update public.orders
  set status = 'delivered', delivered_at = now()
  where id = p_order_id and public.can_act_for_seller(seller_id) and status in ('paid', 'in_delivery') and disputed_at is null
  returning * into o;
  if not found then
    raise exception 'invalid_transition' using errcode = '22023';
  end if;
  perform public.notify(o.buyer_id, 'order_delivered', '¿Recibiste tu pedido?',
    'Confírmalo o repórtanos un problema. Si no nos dices nada, en ' || days || ' días daremos la compra por buena.', o.id);
end;
$$;

-- Contact of the other party; for a managed seller, the warehouse contact.
create or replace function public.order_contact(p_order_id uuid)
returns table (display_name text, email text, phone text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.display_name,
    case when p.is_managed then nullif(public.get_setting('managed_contact_email') #>> '{}', '') else pp.email end,
    case when p.is_managed then nullif(public.get_setting('managed_contact_phone') #>> '{}', '') else pp.phone end
  from public.orders o
  join public.profiles p on p.id = case when o.buyer_id = auth.uid() then o.seller_id else o.buyer_id end
  join public.private_profiles pp on pp.id = p.id
  where o.id = p_order_id
    and auth.uid() in (o.buyer_id, o.seller_id)
    and o.status in ('paid', 'in_delivery', 'delivered', 'completed');
$$;

-- Withdrawals: shared body; users request their own, the server (for admins)
-- requests for managed sellers.
create or replace function public.withdraw_for(p_user uuid, p_amount_cents integer)
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
  if p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents < min_cents then
    raise exception 'amount_too_small' using errcode = '22023';
  end if;
  select * into acct from public.bank_accounts where user_id = p_user;
  if not found then
    raise exception 'bank_account_required' using errcode = '22023';
  end if;

  insert into public.withdrawals (user_id, amount_cents, payout_date, clabe, holder_name, bank_name)
  values (p_user, p_amount_cents, public.withdrawal_payout_date(), acct.clabe, acct.holder_name, acct.bank_name)
  returning * into w;
  perform public.wallet_post(p_user, 'withdrawal', -p_amount_cents, null, w.id, null, true);
  return w;
end;
$$;

create or replace function public.request_withdrawal(p_amount_cents integer)
returns public.withdrawals
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_active_user() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return public.withdraw_for(auth.uid(), p_amount_cents);
end;
$$;

revoke execute on function public.can_act_for_seller(uuid) from public, anon;
grant execute on function public.can_act_for_seller(uuid) to authenticated;
revoke execute on function public.withdraw_for(uuid, integer) from public, anon, authenticated;
grant execute on function public.withdraw_for(uuid, integer) to service_role;
revoke execute on function public.order_mark_shipped(uuid, text, text) from public, anon;
revoke execute on function public.order_mark_delivered(uuid) from public, anon;
revoke execute on function public.order_contact(uuid) from public, anon;
revoke execute on function public.request_withdrawal(integer) from public, anon;
grant execute on function public.order_mark_shipped(uuid, text, text) to authenticated;
grant execute on function public.order_mark_delivered(uuid) to authenticated;
grant execute on function public.order_contact(uuid) to authenticated;
grant execute on function public.request_withdrawal(integer) to authenticated;
