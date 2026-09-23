-- Minimal stand-ins for the Supabase platform objects the migrations rely on.
-- Used ONLY by scripts/db/test.sh to validate migrations + RLS against a plain
-- PostgreSQL without Docker. Never run this against a real Supabase project.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema extensions;
create schema auth;
create schema storage;
grant usage on schema auth, storage, extensions, public to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'
);

create function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

create table storage.buckets (
  id text primary key, name text, public boolean,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id), name text, owner uuid
);
alter table storage.objects enable row level security;
grant all on storage.objects to authenticated, service_role;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
grant execute on function storage.foldername(text) to authenticated;

-- Supabase grants everything in public to the API roles by default.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
