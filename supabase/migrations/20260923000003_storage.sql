-- =============================================================================
-- Storage buckets
--   listing-images: {user_id}/{listing_id}/{file}  and  {user_id}/concierge/{request_id}/{file}
--   avatars:        {user_id}/{file}
-- Images are public-read (served by CDN); only the owner folder is writable.
-- Size and MIME limits are enforced by the bucket itself, not only the UI.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('listing-images', 'listing-images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "users upload to own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('listing-images', 'avatars')
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_active_user()
  );

create policy "users update own files"
  on storage.objects for update to authenticated
  using (
    bucket_id in ('listing-images', 'avatars')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users delete own files"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('listing-images', 'avatars')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
