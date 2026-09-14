-- Migration 014: harden book-photos Storage + book_photos uniqueness.
-- Idempotent — safe in Supabase SQL Editor.
-- Apply BEFORE deploy if production upload fails with RLS / missing bucket limits.
-- Do NOT assume this was already applied; verify in Dashboard if unsure.
--
-- Path convention (must match app code):
--   {auth.uid()}/{book_project_id}/{photo_id}-{filename}

-- ---------------------------------------------------------------------------
-- 1) Private bucket + 10 MiB + MIME allow-list
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'book-photos',
  'book-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 2) Storage policies (owner folder = auth.uid())
-- ---------------------------------------------------------------------------
drop policy if exists "book_photos_read_own" on storage.objects;
drop policy if exists "book_photos_insert_own" on storage.objects;
drop policy if exists "book_photos_update_own" on storage.objects;
drop policy if exists "book_photos_delete_own" on storage.objects;

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

-- ---------------------------------------------------------------------------
-- 3) Idempotent register: one row per (project, storage_path)
-- ---------------------------------------------------------------------------
create unique index if not exists book_photos_project_storage_path_uidx
  on public.book_photos (book_project_id, storage_path);
