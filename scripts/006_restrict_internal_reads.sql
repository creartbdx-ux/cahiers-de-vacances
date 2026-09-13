-- Migration 006: restrict read access on internal engine tables.
-- palettes / styles / universes keep their public-read policies (they are
-- surfaced to customers during book creation). games, templates and assets
-- are engine internals and should not be publicly readable: reads become
-- admin-only. All writes remain admin-only (defined in migration 002).

drop policy if exists "games_read_all" on public.games;
drop policy if exists "templates_read_all" on public.templates;
drop policy if exists "assets_read_all" on public.assets;

create policy "games_read_admin" on public.games
  for select using (public.is_admin());

create policy "templates_read_admin" on public.templates
  for select using (public.is_admin());

-- Assets: admin-only reads for now. VALIDATED + active assets can be opened up
-- to public reads later by adding a permissive select policy at that time.
create policy "assets_read_admin" on public.assets
  for select using (public.is_admin());
