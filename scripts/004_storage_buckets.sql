-- Migration 004: private storage buckets and their access policies.
-- Applied to Supabase via the MCP; kept here for version control.

insert into storage.buckets (id, name, public)
values ('assets', 'assets', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('book-photos', 'book-photos', false)
on conflict (id) do nothing;

-- assets bucket: authenticated read, admin write.
create policy "assets_read_authenticated" on storage.objects
  for select using (bucket_id = 'assets' and auth.role() = 'authenticated');
create policy "assets_admin_insert" on storage.objects
  for insert with check (bucket_id = 'assets' and public.is_admin());
create policy "assets_admin_update" on storage.objects
  for update using (bucket_id = 'assets' and public.is_admin())
  with check (bucket_id = 'assets' and public.is_admin());
create policy "assets_admin_delete" on storage.objects
  for delete using (bucket_id = 'assets' and public.is_admin());

-- book-photos bucket: strictly private, namespaced by owner uid folder.
create policy "book_photos_read_own" on storage.objects
  for select using (
    bucket_id = 'book-photos' and (
      public.is_admin() or (storage.foldername(name))[1] = auth.uid()::text
    )
  );
create policy "book_photos_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'book-photos' and (storage.foldername(name))[1] = auth.uid()::text
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
