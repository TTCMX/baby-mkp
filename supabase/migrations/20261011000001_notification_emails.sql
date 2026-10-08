-- =============================================================================
-- Every notification is also emailed (Resend, from the server). The server
-- claims pending rows after each action that may create them and in the daily
-- cron; a claim marks them, a failed send releases them for a retry.
-- =============================================================================

alter table public.notifications add column if not exists emailed_at timestamptz;
-- What already exists was seen in the app: don't email it at launch.
update public.notifications set emailed_at = created_at where emailed_at is null;

create index if not exists notifications_email_pending_idx on public.notifications (created_at)
  where emailed_at is null;

-- Claims up to p_limit pending notifications (from the last 2 days) with their
-- recipient. Managed profiles have no real inbox (reserved .invalid domain).
create or replace function public.claim_notification_emails(p_limit integer default 50)
returns table (id uuid, email text, display_name text, title text, body text, link text)
language sql
security definer
set search_path = ''
as $$
  with pending as (
    select n.id
    from public.notifications n
    where n.emailed_at is null and n.created_at > now() - interval '2 days'
    order by n.created_at
    limit greatest(p_limit, 0)
    for update skip locked
  ), claimed as (
    update public.notifications n set emailed_at = now()
    from pending
    where n.id = pending.id
    returning n.id, n.user_id, n.title, n.body, n.link
  )
  select c.id, pp.email, p.display_name, c.title, c.body, c.link
  from claimed c
  join public.profiles p on p.id = c.user_id
  join public.private_profiles pp on pp.id = c.user_id
  where pp.email is not null and pp.email not like '%.invalid';
$$;

-- A send failed: back to pending so the next flush retries it.
create or replace function public.release_notification_email(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notifications set emailed_at = null where id = p_id;
$$;

revoke execute on function public.claim_notification_emails(integer) from public, anon, authenticated;
revoke execute on function public.release_notification_email(uuid) from public, anon, authenticated;
grant execute on function public.claim_notification_emails(integer) to service_role;
grant execute on function public.release_notification_email(uuid) to service_role;
