-- Balance: credit on completion, spend at checkout, refunds, withdrawals, privacy.
begin;

create function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'ASSERTION FAILED: %', msg; end if;
end $$;
create function pg_temp.expect_error(stmt text, expected text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if position(expected in sqlerrm) = 0 then
      raise exception 'expected error "%" but got "%" for: %', expected, sqlerrm, stmt;
    end if;
    return;
  end;
  raise exception 'expected error "%" but statement succeeded: %', expected, stmt;
end $$;
create function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.bal(uid uuid) returns integer language sql as $$
  select coalesce((select balance_cents from public.wallets where user_id = uid), 0);
$$;
grant execute on all functions in schema pg_temp to anon, authenticated;

-- ------------------------------------------------------------ pure helpers
select pg_temp.assert(public.is_valid_clabe('002180001234567896'), 'valid CLABE');
select pg_temp.assert(not public.is_valid_clabe('002180001234567890'), 'bad check digit');
select pg_temp.assert(not public.is_valid_clabe('00218000123456789'), 'too short');
-- Friday 23:59 cutoff (Mexico City, UTC-6) → next Tuesday
select pg_temp.assert(public.withdrawal_payout_date('2026-10-02 23:30-06') = '2026-10-06', 'friday night → tuesday 6');
select pg_temp.assert(public.withdrawal_payout_date('2026-10-03 00:10-06') = '2026-10-13', 'saturday → tuesday 13');
select pg_temp.assert(public.withdrawal_payout_date('2026-10-05 09:00-06') = '2026-10-13', 'monday → tuesday 13');
select pg_temp.assert(public.withdrawal_payout_date('2026-10-06 09:00-06') = '2026-10-13', 'tuesday → next tuesday');
select pg_temp.assert(public.withdrawal_payout_date('2026-10-09 23:59-06') = '2026-10-13', 'friday → tuesday 13');

-- ------------------------------------------------------------------ setup
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'wseller@example.com'),
  ('00000000-0000-0000-0000-0000000000e2', 'wbuyer@example.com'),
  ('00000000-0000-0000-0000-0000000000e3', 'wstranger@example.com');

insert into public.listings (id, seller_id, title, category_id, condition, age_stages, price_cents, city, delivery_methods, status)
select ('70000000-0000-0000-0000-00000000000' || g)::uuid, '00000000-0000-0000-0000-0000000000e1', 'Producto ' || g, id, 'good', '{0_3m}',
  100000, 'CDMX', '{pickup}', 'active'
from public.categories, generate_series(1, 4) g where slug = 'ropa';
grant select on public.orders to authenticated;

-- ---------------------------------------- completion credits the seller once
create temp table o (n int, id uuid);
grant select on o to authenticated;
insert into o values (1, public.create_checkout_order('70000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000e2', 'pickup', null, 100000, 0, 10, 10000, 90000));
select public.mark_order_paid((select id from o where n = 1), 'pi_w1', 'ch_w1', 100000, 3900);
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e2');
select public.order_confirm_received((select id from o where n = 1));
reset role;
select pg_temp.assert(pg_temp.bal('00000000-0000-0000-0000-0000000000e1') = 90000, 'seller credited seller_net on completion');
select pg_temp.assert((select count(*) from public.wallet_entries where kind = 'sale' and order_id = (select id from o where n = 1)) = 1, 'one sale entry');
select public.wallet_post('00000000-0000-0000-0000-0000000000e1', 'sale', 90000, (select id from o where n = 1));
select pg_temp.assert(pg_temp.bal('00000000-0000-0000-0000-0000000000e1') = 90000, 'sale credit is idempotent');

-- ------------------------------------------------------ seller spends balance
-- Partial: 60,000 of balance + 40,000 by card
insert into public.listings (id, seller_id, title, category_id, condition, age_stages, price_cents, city, delivery_methods, status)
select '70000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-0000000000e3', 'Del tercero', id, 'good', '{0_3m}', 100000, 'CDMX', '{pickup}', 'active'
from public.categories where slug = 'ropa';
insert into o values (2, public.create_checkout_order('70000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-0000000000e1', 'pickup', null, 100000, 0, 10, 10000, 90000, 60000));
select pg_temp.assert(pg_temp.bal('00000000-0000-0000-0000-0000000000e1') = 30000, 'balance taken at checkout');
select pg_temp.assert((select status from public.orders where id = (select id from o where n = 2)) = 'pending_payment', 'card part still pending');
select pg_temp.expect_error($$select public.mark_order_paid((select id from o where n = 2), 'pi_w2', 'ch_w2', 100000, 0)$$, 'amount_mismatch');
-- Abandoned: balance comes back
select public.cancel_pending_order((select id from o where n = 2), 'checkout_expired');
select pg_temp.assert(pg_temp.bal('00000000-0000-0000-0000-0000000000e1') = 90000, 'balance released on cancel');
select public.cancel_pending_order((select id from o where n = 2), 'checkout_expired');
select pg_temp.assert(pg_temp.bal('00000000-0000-0000-0000-0000000000e1') = 90000, 'release is idempotent');

-- More than available → fails, nothing booked
select pg_temp.expect_error($$select public.create_checkout_order('70000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-0000000000e1', 'pickup', null, 100000, 0, 10, 10000, 90000, 95000)$$, 'insufficient_balance');
select pg_temp.assert((select status from public.listings where id = '70000000-0000-0000-0000-000000000009') = 'active', 'listing untouched after failed checkout');

-- Card part paid
insert into o values (3, public.create_checkout_order('70000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-0000000000e1', 'pickup', null, 100000, 0, 10, 10000, 90000, 60000));
select pg_temp.assert(public.mark_order_paid((select id from o where n = 3), 'pi_w3', 'ch_w3', 40000, 1600) = 'paid', 'card pays the rest');

-- Refund: buyer gets the balance part back (the card part goes through Stripe)
select public.refund_order_balances((select id from o where n = 3));
select public.refund_order_balances((select id from o where n = 3));
select pg_temp.assert(pg_temp.bal('00000000-0000-0000-0000-0000000000e1') = 90000, 'balance part refunded once');

-- Fully with balance: no card, paid immediately
update public.orders set status = 'refunded', refunded_at = now() where id = (select id from o where n = 3);
update public.listings set status = 'active' where id = '70000000-0000-0000-0000-000000000009';
update public.listings set price_cents = 50000 where id = '70000000-0000-0000-0000-000000000009';
insert into o values (4, public.create_checkout_order('70000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-0000000000e1', 'pickup', null, 50000, 0, 10, 5000, 45000, 50000));
select pg_temp.assert((select status from public.orders where id = (select id from o where n = 4)) = 'paid', 'paid with balance alone');
select pg_temp.assert((select provider from public.payments where order_id = (select id from o where n = 4)) = 'balance', 'payment recorded as balance');
select pg_temp.assert((select status from public.listings where id = '70000000-0000-0000-0000-000000000009') = 'sold', 'listing sold');
select pg_temp.assert(pg_temp.bal('00000000-0000-0000-0000-0000000000e1') = 40000, 'balance after full purchase');

-- Refund of a completed sale takes it back from the seller (third user)
update public.orders set status = 'completed', completed_at = now() where id = (select id from o where n = 4);
select pg_temp.assert(pg_temp.bal('00000000-0000-0000-0000-0000000000e3') = 45000, 'third user credited');
select public.refund_order_balances((select id from o where n = 4));
select pg_temp.assert(pg_temp.bal('00000000-0000-0000-0000-0000000000e3') = 0, 'sale reversed');
select pg_temp.assert(pg_temp.bal('00000000-0000-0000-0000-0000000000e1') = 90000, 'buyer balance refunded');

-- -------------------------------------------------------------- withdrawals
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select pg_temp.expect_error($$select public.request_withdrawal(10000)$$, 'bank_account_required');
select pg_temp.expect_error($$insert into public.bank_accounts (user_id, clabe, holder_name, bank_name) values (auth.uid(), '002180001234567890', 'Ana López', 'Banamex')$$, 'bank_accounts_clabe_check');
select pg_temp.expect_error($$insert into public.bank_accounts (user_id, clabe, holder_name, bank_name) values ('00000000-0000-0000-0000-0000000000e3', '002180001234567896', 'Otra', 'Banamex')$$, 'row-level security');
insert into public.bank_accounts (user_id, clabe, holder_name, bank_name) values (auth.uid(), '002180001234567896', 'Ana López Pérez', 'Banamex');
select pg_temp.expect_error($$select public.request_withdrawal(0)$$, 'amount_too_small');
select pg_temp.expect_error($$select public.request_withdrawal(90001)$$, 'insufficient_balance');
select pg_temp.assert((select count(*) from public.withdrawals) = 0, 'failed request leaves nothing');
select pg_temp.assert((select payout_date from public.request_withdrawal(70000)) = public.withdrawal_payout_date(), 'withdrawal scheduled');
select pg_temp.assert((select balance_cents from public.wallets where user_id = auth.uid()) = 20000, 'withdrawal debited');
-- Users can't touch the ledger directly or settle their own withdrawal
select pg_temp.expect_error($$update public.wallets set balance_cents = 1000000 where user_id = auth.uid()$$, 'permission denied');
select pg_temp.expect_error($$insert into public.wallet_entries (user_id, kind, amount_cents, balance_after_cents) values (auth.uid(), 'adjustment', 100, 100)$$, 'permission denied');
select pg_temp.expect_error($$select public.settle_withdrawal((select id from public.withdrawals limit 1), true, auth.uid())$$, 'permission denied');
select pg_temp.expect_error($$select public.wallet_post(auth.uid(), 'adjustment', 100000)$$, 'permission denied');
-- Privacy
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e3');
select pg_temp.assert((select count(*) from public.withdrawals) = 0, 'stranger sees no withdrawals');
select pg_temp.assert((select count(*) from public.bank_accounts) = 0, 'stranger sees no bank accounts');
select pg_temp.assert((select count(*) from public.wallet_entries where user_id = '00000000-0000-0000-0000-0000000000e1') = 0, 'stranger sees no ledger');
reset role;
set local role anon;
select pg_temp.expect_error($$select count(*) from public.wallets$$, 'permission denied');
reset role;

-- Admin settles: failed → money back; paid → final
select public.settle_withdrawal((select id from public.withdrawals limit 1), false, null, null, 'CLABE rechazada');
select pg_temp.assert(pg_temp.bal('00000000-0000-0000-0000-0000000000e1') = 90000, 'failed withdrawal returned');
select pg_temp.expect_error($$select public.settle_withdrawal((select id from public.withdrawals limit 1), true, null)$$, 'invalid_transition');
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
select public.request_withdrawal(90000);
reset role;
select public.settle_withdrawal((select id from public.withdrawals where status = 'requested'), true, null, 'SPEI123');
select pg_temp.assert((select status from public.withdrawals where reference = 'SPEI123') = 'paid', 'paid with reference');
select pg_temp.assert(pg_temp.bal('00000000-0000-0000-0000-0000000000e1') = 0, 'balance after paid withdrawal');
-- Ledger and running balance always agree
select pg_temp.assert(not exists (
  select 1 from public.wallets w
  where w.balance_cents <> (select coalesce(sum(amount_cents), 0) from public.wallet_entries e where e.user_id = w.user_id)
), 'wallets = sum(ledger)');

rollback;
