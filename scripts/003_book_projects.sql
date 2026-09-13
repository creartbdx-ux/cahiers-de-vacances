-- Migration 003: customer-owned book data with owner-scoped RLS.
-- Applied to Supabase via the MCP; kept here for version control.

create table if not exists public.book_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  recipient_first_name text,
  status text not null default 'DRAFT',
  style_id text references public.styles(id) on delete set null,
  palette_id text references public.palettes(id) on delete set null,
  questionnaire_data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists book_projects_user_id_idx on public.book_projects (user_id);

create table if not exists public.book_photos (
  id uuid primary key default gen_random_uuid(),
  book_project_id uuid not null references public.book_projects(id) on delete cascade,
  storage_path text not null,
  caption text,
  anecdote text,
  use_authorized boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists book_photos_project_idx on public.book_photos (book_project_id);

create table if not exists public.generated_pages (
  id uuid primary key default gen_random_uuid(),
  book_project_id uuid not null references public.book_projects(id) on delete cascade,
  page_number integer not null,
  game_id text references public.games(id) on delete set null,
  template_id text references public.templates(id) on delete set null,
  universe_id text references public.universes(id) on delete set null,
  page_data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists generated_pages_project_idx on public.generated_pages (book_project_id);

create trigger set_book_projects_updated_at before update on public.book_projects
  for each row execute function public.set_updated_at();
create trigger set_generated_pages_updated_at before update on public.generated_pages
  for each row execute function public.set_updated_at();

alter table public.book_projects enable row level security;
alter table public.book_photos enable row level security;
alter table public.generated_pages enable row level security;

create policy "book_projects_select_own" on public.book_projects
  for select using (auth.uid() = user_id or public.is_admin());
create policy "book_projects_insert_own" on public.book_projects
  for insert with check (auth.uid() = user_id);
create policy "book_projects_update_own" on public.book_projects
  for update using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());
create policy "book_projects_delete_own" on public.book_projects
  for delete using (auth.uid() = user_id or public.is_admin());

create policy "book_photos_select_own" on public.book_photos
  for select using (
    public.is_admin() or exists (
      select 1 from public.book_projects p
      where p.id = book_photos.book_project_id and p.user_id = auth.uid()
    )
  );
create policy "book_photos_insert_own" on public.book_photos
  for insert with check (
    exists (
      select 1 from public.book_projects p
      where p.id = book_photos.book_project_id and p.user_id = auth.uid()
    )
  );
create policy "book_photos_update_own" on public.book_photos
  for update using (
    public.is_admin() or exists (
      select 1 from public.book_projects p
      where p.id = book_photos.book_project_id and p.user_id = auth.uid()
    )
  ) with check (
    public.is_admin() or exists (
      select 1 from public.book_projects p
      where p.id = book_photos.book_project_id and p.user_id = auth.uid()
    )
  );
create policy "book_photos_delete_own" on public.book_photos
  for delete using (
    public.is_admin() or exists (
      select 1 from public.book_projects p
      where p.id = book_photos.book_project_id and p.user_id = auth.uid()
    )
  );

create policy "generated_pages_select_own" on public.generated_pages
  for select using (
    public.is_admin() or exists (
      select 1 from public.book_projects p
      where p.id = generated_pages.book_project_id and p.user_id = auth.uid()
    )
  );
create policy "generated_pages_admin_write" on public.generated_pages
  for all using (public.is_admin()) with check (public.is_admin());
