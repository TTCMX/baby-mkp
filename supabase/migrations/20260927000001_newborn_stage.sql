-- RN (recién nacido): the size before 0–3 meses, first month of life.
-- On its own migration: a new enum value can't be used in the same
-- transaction that creates it (the next migration uses it).
alter type public.age_stage add value if not exists 'newborn' before '0_3m';
