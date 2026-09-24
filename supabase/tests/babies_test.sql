-- Babies: private per parent, date rules, limit.
begin;
create function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'ASSERTION FAILED: %', msg; end if;
end $$;
create function pg_temp.expect_error(stmt text, expected text) returns void language plpgsql as $$
begin
  begin execute stmt; exception when others then
    if position(expected in sqlerrm) = 0 then raise exception 'expected "%" got "%"', expected, sqlerrm; end if;
    return;
  end;
  raise exception 'expected error "%" but statement succeeded', expected;
end $$;
create function pg_temp.act_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
grant execute on all functions in schema pg_temp to anon, authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'mom@example.com'),
  ('00000000-0000-0000-0000-0000000000e2', 'other@example.com');

set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e1');
insert into public.babies (user_id, name, birth_date, color) values (auth.uid(), 'Emilia', current_date - 200, 'pink');
insert into public.babies (user_id, name, due_date) values (auth.uid(), 'Bebé', current_date + 90);
select pg_temp.expect_error($$insert into public.babies (user_id, name, birth_date, due_date) values (auth.uid(), 'X', current_date, current_date + 1)$$, 'babies_one_date');
select pg_temp.expect_error($$insert into public.babies (user_id, name) values (auth.uid(), 'X')$$, 'babies_one_date');
select pg_temp.expect_error($$insert into public.babies (user_id, name, birth_date) values (auth.uid(), 'X', current_date + 1)$$, 'babies_birth_not_future');
select pg_temp.expect_error($$insert into public.babies (user_id, name, birth_date) values ('00000000-0000-0000-0000-0000000000e2', 'Hack', current_date)$$, 'row-level security');
select pg_temp.assert((select count(*) from public.babies) = 2, 'parent sees own babies');

-- Another user sees nothing and can't touch them
select pg_temp.act_as('00000000-0000-0000-0000-0000000000e2');
select pg_temp.assert((select count(*) from public.babies) = 0, 'private to parent');
update public.babies set name = 'x';
delete from public.babies;
reset role;
select pg_temp.assert((select count(*) from public.babies where name <> 'x') = 2, 'untouched by others');

-- Anonymous: no access at all
set local role anon;
select pg_temp.expect_error($$select * from public.babies$$, 'permission denied');
reset role;

-- Limit of 8 per family
insert into public.babies (user_id, name, birth_date) select '00000000-0000-0000-0000-0000000000e1', 'B' || g, current_date from generate_series(1, 6) g;
select pg_temp.expect_error($$insert into public.babies (user_id, name, birth_date) values ('00000000-0000-0000-0000-0000000000e1', 'Nueve', current_date)$$, 'too_many_babies');
rollback;
