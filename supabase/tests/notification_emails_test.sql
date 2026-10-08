-- Notification emails: claim once, skip managed inboxes, release on failure, server only.
begin;

create function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'ASSERTION FAILED: %', msg; end if;
end $$;
grant execute on all functions in schema pg_temp to anon, authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'mama@example.com', '{"display_name":"Mamá"}'),
  ('00000000-0000-0000-0000-0000000000e2', 'gestionado-x@gestionado.invalid', '{"display_name":"Bodega"}');
update public.notifications set emailed_at = now() where emailed_at is null; -- start clean

insert into public.notifications (id, user_id, type, title, body, link, created_at) values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000e1', 'order_paid', '¡Vendiste!', 'Carriola', '/orders/1', now()),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000e2', 'order_paid', '¡Vendiste!', null, '/orders/2', now()),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000e1', 'old', 'Viejo', null, null, now() - interval '3 days');

select pg_temp.assert(
  (select array_agg(email || '|' || title) from public.claim_notification_emails(10)) = '{"mama@example.com|¡Vendiste!"}',
  'only the real inbox, only recent');
select pg_temp.assert((select emailed_at is not null from public.notifications where id = 'a0000000-0000-0000-0000-000000000002'), 'managed one is marked, not sent');
select pg_temp.assert((select emailed_at is null from public.notifications where id = 'a0000000-0000-0000-0000-000000000003'), 'old one left alone');
select pg_temp.assert((select count(*) from public.claim_notification_emails(10)) = 0, 'claimed only once');

select public.release_notification_email('a0000000-0000-0000-0000-000000000001');
select pg_temp.assert((select count(*) from public.claim_notification_emails(10)) = 1, 'released → claimed again');

-- Users can't claim (they'd read other people's emails).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
do $$ begin
  perform public.claim_notification_emails(10);
  raise exception 'ASSERTION FAILED: users must not claim emails';
exception when insufficient_privilege then null;
end $$;
reset role;

rollback;
