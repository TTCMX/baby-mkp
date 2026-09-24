-- =============================================================================
-- Order lifecycle after payment: delivery, confirmation, disputes, auto
-- completion, payouts bookkeeping and counterpart contact.
--
--   paid ──(seller: shipped)──▶ in_delivery ──(seller: delivered)──▶ delivered
--     │                                                                  │
--     └──────────(buyer: "lo recibí")──────────────┬──────────(N days, no dispute)
--                                                  ▼
--                                              completed ──▶ payout to seller
--
-- A buyer-reported problem freezes auto-completion and the payout until an
-- admin resolves it.
-- =============================================================================

alter table public.orders
  add column if not exists tracking_carrier text check (char_length(tracking_carrier) <= 60),
  add column if not exists tracking_number text check (char_length(tracking_number) <= 80),
  add column if not exists disputed_at timestamptz,
  add column if not exists dispute_reason text check (char_length(dispute_reason) <= 1000);

alter table public.payouts
  add column if not exists failure_reason text;

insert into public.platform_settings (key, value, description) values
  ('order_auto_complete_days', '3', 'Días después de marcar "entregado" para completar la orden si el comprador no confirma ni reporta un problema')
on conflict (key) do nothing;

create index if not exists orders_delivered_due_idx on public.orders (delivered_at)
  where status = 'delivered' and disputed_at is null;

-- Helper: notify one user.
create or replace function public.notify(p_user uuid, p_type text, p_title text, p_body text, p_order uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, type, title, body, link, data)
  values (p_user, p_type, p_title, p_body, '/orders/' || p_order, jsonb_build_object('order_id', p_order));
$$;

-- ---------------------------------------------------------------- seller steps
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
  where id = p_order_id and seller_id = auth.uid() and status = 'paid' and disputed_at is null
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
  where id = p_order_id and seller_id = auth.uid() and status in ('paid', 'in_delivery') and disputed_at is null
  returning * into o;
  if not found then
    raise exception 'invalid_transition' using errcode = '22023';
  end if;
  perform public.notify(o.buyer_id, 'order_delivered', '¿Recibiste tu pedido?',
    'Confírmalo o repórtanos un problema. Si no nos dices nada, en ' || days || ' días daremos la compra por buena.', o.id);
end;
$$;

-- ----------------------------------------------------------------- buyer steps
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
  where id = p_order_id and buyer_id = auth.uid()
    and status in ('paid', 'in_delivery', 'delivered') and disputed_at is null
  returning * into o;
  if not found then
    raise exception 'invalid_transition' using errcode = '22023';
  end if;
  perform public.notify(o.seller_id, 'order_completed', '¡Venta completada!',
    'El comprador confirmó que recibió el producto. Estamos liberando tu pago.', o.id);
end;
$$;

create or replace function public.order_report_problem(p_order_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
begin
  if char_length(trim(coalesce(p_reason, ''))) < 10 then
    raise exception 'reason_too_short' using errcode = '22023';
  end if;
  update public.orders
  set disputed_at = now(), dispute_reason = left(trim(p_reason), 1000)
  where id = p_order_id and buyer_id = auth.uid()
    and status in ('paid', 'in_delivery', 'delivered') and disputed_at is null
  returning * into o;
  if not found then
    raise exception 'invalid_transition' using errcode = '22023';
  end if;
  perform public.notify(o.seller_id, 'order_disputed', 'El comprador reportó un problema',
    'Nuestro equipo lo revisará contigo. El pago queda en pausa mientras tanto.', o.id);
end;
$$;

-- ------------------------------------------------------ system (service role)
-- Completes delivered orders whose confirmation window elapsed. Optionally a
-- single order (used when someone opens it). Returns the completed ids.
create or replace function public.complete_due_orders(p_order_id uuid default null)
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  days int := coalesce((public.get_setting('order_auto_complete_days'))::int, 3);
  o public.orders;
begin
  for o in
    update public.orders
    set status = 'completed', completed_at = now()
    where status = 'delivered' and disputed_at is null
      and delivered_at < now() - make_interval(days => days)
      and (p_order_id is null or id = p_order_id)
    returning *
  loop
    perform public.notify(o.seller_id, 'order_completed', '¡Venta completada!',
      'Se cumplió el plazo de confirmación. Estamos liberando tu pago.', o.id);
    return next o.id;
  end loop;
end;
$$;

-- Contact details of the other party, only after payment and only to participants.
create or replace function public.order_contact(p_order_id uuid)
returns table (display_name text, email text, phone text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.display_name, pp.email, pp.phone
  from public.orders o
  join public.profiles p on p.id = case when o.buyer_id = auth.uid() then o.seller_id else o.buyer_id end
  join public.private_profiles pp on pp.id = p.id
  where o.id = p_order_id
    and auth.uid() in (o.buyer_id, o.seller_id)
    and o.status in ('paid', 'in_delivery', 'delivered', 'completed');
$$;

revoke execute on function public.notify(uuid, text, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.order_mark_shipped(uuid, text, text) from public, anon;
revoke execute on function public.order_mark_delivered(uuid) from public, anon;
revoke execute on function public.order_confirm_received(uuid) from public, anon;
revoke execute on function public.order_report_problem(uuid, text) from public, anon;
revoke execute on function public.order_contact(uuid) from public, anon;
revoke execute on function public.complete_due_orders(uuid) from public, anon, authenticated;
grant execute on function public.order_mark_shipped(uuid, text, text) to authenticated;
grant execute on function public.order_mark_delivered(uuid) to authenticated;
grant execute on function public.order_confirm_received(uuid) to authenticated;
grant execute on function public.order_report_problem(uuid, text) to authenticated;
grant execute on function public.order_contact(uuid) to authenticated;
grant execute on function public.complete_due_orders(uuid) to service_role;
