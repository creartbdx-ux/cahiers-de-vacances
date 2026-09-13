-- Migration 011: ensure private Storage bucket "book-photos" + policies.
-- Idempotent — safe to run in Supabase SQL Editor even if 004 never ran.
--
-- Bucket stays PRIVATE (no public access). Paths are namespaced:
--   {auth.uid()}/{book_project_id}/{photo_id}-{filename}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'book-photos',
  'book-photos',
  false,
  10485760, -- 10 MiB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Drop + recreate policies so re-runs stay idempotent.
drop policy if exists "book_photos_read_own" on storage.objects;
drop policy if exists "book_photos_insert_own" on storage.objects;
drop policy if exists "book_photos_update_own" on storage.objects;
drop policy if exists "book_photos_delete_own" on storage.objects;

-- Owners can read/write objects under their uid folder; admins can read/update/delete.
create policy "book_photos_read_own" on storage.objects
  for select using (
    bucket_id = 'book-photos' and (
      public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text
    )
  );

create policy "book_photos_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'book-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "book_photos_update_own" on storage.objects
  for update using (
    bucket_id = 'book-photos' and (
      public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text
    )
  ) with check (
    bucket_id = 'book-photos' and (
      public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text
    )
  );

create policy "book_photos_delete_own" on storage.objects
  for delete using (
    bucket_id = 'book-photos' and (
      public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text
    )
  );
