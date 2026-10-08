-- =============================================================================
-- The app emails password-reset links itself (Resend), so it also rate-limits
-- them: at most 3 per email per hour. Server only (service role).
-- =============================================================================

create table if not exists public.password_reset_requests (
  id bigint generated always as identity primary key,
  email text not null check (char_length(email) <= 320),
  created_at timestamptz not null default now()
);
create index if not exists password_reset_requests_email_idx on public.password_reset_requests (email, created_at desc);

alter table public.password_reset_requests enable row level security;
revoke all on public.password_reset_requests from anon, authenticated;

-- Records a request and says whether it may send (true) or is over the limit.
create or replace function public.allow_password_reset(p_email text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent integer;
begin
  delete from public.password_reset_requests where created_at < now() - interval '1 day';
  select count(*) into recent from public.password_reset_requests
  where email = lower(p_email) and created_at > now() - interval '1 hour';
  if recent >= 3 then
    return false;
  end if;
  insert into public.password_reset_requests (email) values (lower(p_email));
  return true;
end;
$$;

revoke execute on function public.allow_password_reset(text) from public, anon, authenticated;
grant execute on function public.allow_password_reset(text) to service_role;
