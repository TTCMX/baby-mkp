-- =============================================================================
-- Shipping belongs to the platform (it ships and pays the labels): the seller's
-- balance gets item price − commission; the platform keeps commission + shipping
-- − Stripe fee. Orders not completed yet are corrected; completed ones (already
-- in the sellers' balance) stay as they were.
-- =============================================================================

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
     or p_seller_net_cents <> p_item_price_cents - p_platform_commission_cents then
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
    p_platform_commission_cents, p_seller_net_cents, p_platform_commission_cents + p_shipping_cents, p_balance_cents
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
      platform_net_cents = platform_commission_cents + shipping_cents - p_fee_cents
  where id = o.id;

  insert into public.payments (order_id, stripe_payment_intent_id, stripe_charge_id, amount_cents, fee_cents, status, currency)
  values (o.id, p_payment_intent_id, p_charge_id, p_amount_cents, p_fee_cents, 'succeeded', o.currency)
  on conflict (stripe_payment_intent_id) do update
    set status = 'succeeded', stripe_charge_id = excluded.stripe_charge_id, fee_cents = excluded.fee_cents;

  perform public.order_paid_effects(o.id);
  return 'paid';
end;
$$;

update public.orders
set seller_net_cents = seller_net_cents - shipping_cents,
    platform_net_cents = platform_net_cents + shipping_cents
where shipping_cents > 0
  and status in ('pending_payment', 'paid', 'in_delivery', 'delivered')
  and seller_net_cents = item_price_cents - platform_commission_cents + shipping_cents;

revoke execute on function public.create_checkout_order(uuid, uuid, public.delivery_method, jsonb, integer, integer, numeric, integer, integer, integer) from public, anon, authenticated;
revoke execute on function public.mark_order_paid(uuid, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.create_checkout_order(uuid, uuid, public.delivery_method, jsonb, integer, integer, numeric, integer, integer, integer) to service_role;
grant execute on function public.mark_order_paid(uuid, text, text, integer, integer) to service_role;
