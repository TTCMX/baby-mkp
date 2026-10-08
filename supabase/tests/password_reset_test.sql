-- Password-reset emails: at most 3 per email per hour, server only.
begin;

create function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'ASSERTION FAILED: %', msg; end if;
end $$;
grant execute on all functions in schema pg_temp to anon, authenticated;

select pg_temp.assert(public.allow_password_reset('Mama@Example.com'), '1st');
select pg_temp.assert(public.allow_password_reset('mama@example.com'), '2nd (case-insensitive)');
select pg_temp.assert(public.allow_password_reset('mama@example.com'), '3rd');
select pg_temp.assert(not public.allow_password_reset('mama@example.com'), '4th within the hour is refused');
select pg_temp.assert(public.allow_password_reset('otra@example.com'), 'other emails unaffected');
update public.password_reset_requests set created_at = now() - interval '2 hours' where email = 'mama@example.com';
select pg_temp.assert(public.allow_password_reset('mama@example.com'), 'allowed again after an hour');

set local role anon;
do $$ begin
  perform public.allow_password_reset('x@example.com');
  raise exception 'ASSERTION FAILED: anon must not call it';
exception when insufficient_privilege then null;
end $$;
reset role;

rollback;
