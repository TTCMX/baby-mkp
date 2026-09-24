-- Search: "rn" / "recién nacido" find RN listings.
create or replace function public.age_stage_label(s public.age_stage)
returns text
language sql
immutable
set search_path = ''
as $$
  select case s
    when 'pregnancy' then 'embarazo'
    when 'newborn' then 'rn recién nacido 0 1 mes'
    when '0_3m' then '0 3 meses recién nacido'
    when '3_6m' then '3 6 meses'
    when '6_12m' then '6 12 meses'
    when '1_2y' then '1 2 años'
    when '2_4y' then '2 4 años'
    when '4y_plus' then '4 años'
    when 'all_ages' then 'todas las edades'
  end;
$$;
revoke execute on function public.age_stage_label(public.age_stage) from public, anon, authenticated;
