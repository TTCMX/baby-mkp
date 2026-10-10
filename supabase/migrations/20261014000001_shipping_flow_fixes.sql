-- =============================================================================
-- Audit fixes for shipping orders:
-- * A shipping order must go out with its label before it can be delivered or
--   confirmed (the seller could jump paid → delivered, and a buyer could
--   "confirm" an order that hadn't even shipped, releasing the money).
-- * The seller says where the package leaves from (the platform needs it to
--   buy the label); snapshot on the order.
-- * Admins are notified (in the app and by email) of every paid order they
--   have to act on: a shipping order needing a label, or a warehouse sale.
-- =============================================================================

alter table public.orders add column if not exists pickup_address jsonb;

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
  where id = p_order_id and public.can_act_for_seller(seller_id) and disputed_at is null
    -- Shipping goes paid → in_delivery (with label) → delivered; pickups can skip the middle step.
    and (status = 'in_delivery' or (status = 'paid' and delivery_method <> 'shipping'))
  returning * into o;
  if not found then
    raise exception 'invalid_transition' using errcode = '22023';
  end if;
  perform public.notify(o.buyer_id, 'order_delivered', '¿Recibiste tu pedido?',
    'Confírmalo o repórtanos un problema. Si no nos dices nada, en ' || days || ' días daremos la compra por buena.', o.id);
end;
$$;

create or replace function public.order_confirm_received(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
begin
  update public.orders
  set status = 'completed', completed_at = now(), delivered_at = coalesce(delivered_at, now())
  where id = p_order_id and buyer_id = auth.uid() and disputed_at is null
    -- A shipping order can only be received once it has been sent.
    and (status in ('in_delivery', 'delivered') or (status = 'paid' and delivery_method <> 'shipping'))
  returning * into o;
  if not found then
    raise exception 'invalid_transition' using errcode = '22023';
  end if;
  perform public.notify(o.seller_id, 'order_completed', '¡Venta completada!',
    'El comprador confirmó que recibió el producto. Estamos liberando tu pago.', o.id);
end;
$$;

-- Every active admin gets the notice (and its email).
create or replace function public.notify_admins(p_type text, p_title text, p_body text, p_order uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, type, title, body, link, data)
  select p.id, p_type, p_title, p_body, '/admin/orders/' || p_order, jsonb_build_object('order_id', p_order)
  from public.profiles p
  where p.role = 'admin' and p.status = 'active';
$$;

create or replace function public.orders_notify_admins()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  managed boolean;
  title text;
begin
  select is_managed into managed from public.profiles where id = new.seller_id;
  title := (select string_agg(oi.title, ', ') from public.order_items oi where oi.order_id = new.id);
  if new.delivery_method = 'shipping' then
    perform public.notify_admins('admin_label_needed', 'Nueva venta con envío: genera la guía',
      coalesce(title, 'Pedido') || case when managed then ' (bodega)' else '' end, new.id);
  elsif managed then
    perform public.notify_admins('admin_managed_sale', 'Venta de la bodega: prepara la entrega',
      coalesce(title, 'Pedido'), new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists orders_notify_admins_trg on public.orders;
create trigger orders_notify_admins_trg
  after update of status on public.orders
  for each row
  when (new.status = 'paid' and old.status is distinct from 'paid')
  execute function public.orders_notify_admins();

revoke execute on function public.notify_admins(text, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.orders_notify_admins() from public, anon, authenticated;
revoke execute on function public.order_mark_delivered(uuid) from public, anon;
revoke execute on function public.order_confirm_received(uuid) from public, anon;
grant execute on function public.order_mark_delivered(uuid) to authenticated;
grant execute on function public.order_confirm_received(uuid) to authenticated;
