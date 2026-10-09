-- =============================================================================
-- Prepaid shipping labels: the platform buys the label and attaches it to the
-- order (Admin → Pedidos); the seller downloads it, packs and drops it off.
-- A shipping order can be marked as shipped only once it has its label.
-- =============================================================================

alter table public.orders
  add column if not exists shipping_label_url text
    check (shipping_label_url is null or (shipping_label_url ~ '^https://' and char_length(shipping_label_url) <= 2000)),
  add column if not exists label_sent_at timestamptz;

-- Admin queue: paid shipping orders still waiting for their label.
create index if not exists orders_needs_label_idx on public.orders (paid_at)
  where delivery_method = 'shipping' and status = 'paid' and shipping_label_url is null;

create or replace function public.order_mark_shipped(p_order_id uuid, p_carrier text, p_tracking text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
begin
  select * into o from public.orders
  where id = p_order_id and public.can_act_for_seller(seller_id) and status = 'paid' and disputed_at is null;
  if not found then
    raise exception 'invalid_transition' using errcode = '22023';
  end if;
  if o.delivery_method = 'shipping' and o.shipping_label_url is null then
    raise exception 'label_required' using errcode = '22023';
  end if;

  update public.orders
  set status = 'in_delivery', shipped_at = now(),
      -- The label already carries them; what the seller types (if anything) wins.
      tracking_carrier = coalesce(nullif(trim(p_carrier), ''), tracking_carrier),
      tracking_number = coalesce(nullif(trim(p_tracking), ''), tracking_number)
  where id = o.id
  returning * into o;
  perform public.notify(o.buyer_id, 'order_shipped', 'Tu pedido va en camino',
    coalesce('Guía: ' || o.tracking_carrier || ' ' || o.tracking_number, 'El vendedor ya lo envió.'), o.id);
end;
$$;

revoke execute on function public.order_mark_shipped(uuid, text, text) from public, anon;
grant execute on function public.order_mark_shipped(uuid, text, text) to authenticated;
