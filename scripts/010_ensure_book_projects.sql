-- Migration 010: ensure public.book_projects (+ book_photos, generated_pages)
-- and owner-scoped RLS. Idempotent — safe to run in Supabase SQL Editor.
--
-- Derived from current app code (lib/data/books.ts, lib/supabase/types.ts,
-- questionnaire actions) and the historical scripts 001 + 003.
--
-- Prerequisites: auth.users (Supabase Auth). Helpers set_updated_at / is_admin
-- and the auth.users → profiles sync are re-created here so this script can
-- recover a live DB that never received migrations 001–003. Optional FKs to
-- styles/palettes are added only if those tables already exist.

-- ---------------------------------------------------------------------------
-- Helpers (from 001 — required by triggers + RLS)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('admin', 'customer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Admin check as SECURITY DEFINER so policies can call it without recursing
-- into profiles' own RLS (same pattern as migration 001).
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row when a new auth user is created (from 001).
-- SECURITY DEFINER + empty search_path: insert bypasses RLS, no recursion.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'customer')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: existing auth.users without a profile get role='customer'.
-- ON CONFLICT DO NOTHING never overwrites an existing row (preserves admin).
insert into public.profiles (id, role)
select u.id, 'customer'
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- book_projects
-- Columns used by the app today:
--   id, user_id, recipient_first_name, status, style_id, palette_id,
--   questionnaire_data, created_at, updated_at
-- Audience / BookProfileV1 live inside questionnaire_data (jsonb), not as
-- separate columns.
-- Status values written by the app:
--   DRAFT | QUESTIONNAIRE_IN_PROGRESS | QUESTIONNAIRE_COMPLETED
-- ---------------------------------------------------------------------------
create table if not exists public.book_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  recipient_first_name text,
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'QUESTIONNAIRE_IN_PROGRESS', 'QUESTIONNAIRE_COMPLETED')),
  style_id text,
  palette_id text,
  questionnaire_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Optional FKs when reference tables already exist (do not fail if absent).
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'styles'
  ) then
    alter table public.book_projects drop constraint if exists book_projects_style_id_fkey;
    alter table public.book_projects
      add constraint book_projects_style_id_fkey
      foreign key (style_id) references public.styles(id) on delete set null;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'palettes'
  ) then
    alter table public.book_projects drop constraint if exists book_projects_palette_id_fkey;
    alter table public.book_projects
      add constraint book_projects_palette_id_fkey
      foreign key (palette_id) references public.palettes(id) on delete set null;
  end if;
end $$;

create index if not exists book_projects_user_id_idx on public.book_projects (user_id);
create index if not exists book_projects_status_idx on public.book_projects (status);
create index if not exists book_projects_updated_at_idx on public.book_projects (updated_at desc);

drop trigger if exists set_book_projects_updated_at on public.book_projects;
create trigger set_book_projects_updated_at
  before update on public.book_projects
  for each row execute function public.set_updated_at();

alter table public.book_projects enable row level security;

drop policy if exists "book_projects_select_own" on public.book_projects;
create policy "book_projects_select_own" on public.book_projects
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "book_projects_insert_own" on public.book_projects;
create policy "book_projects_insert_own" on public.book_projects
  for insert with check (auth.uid() = user_id);

drop policy if exists "book_projects_update_own" on public.book_projects;
create policy "book_projects_update_own" on public.book_projects
  for update
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "book_projects_delete_own" on public.book_projects;
create policy "book_projects_delete_own" on public.book_projects
  for delete using (auth.uid() = user_id or public.is_admin());

grant select, insert, update, delete on table public.book_projects to authenticated;
grant all on table public.book_projects to service_role;

-- ---------------------------------------------------------------------------
-- book_photos (depends on book_projects — used by questionnaire photo upload)
-- ---------------------------------------------------------------------------
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

alter table public.book_photos enable row level security;

drop policy if exists "book_photos_select_own" on public.book_photos;
create policy "book_photos_select_own" on public.book_photos
  for select using (
    public.is_admin() or exists (
      select 1 from public.book_projects p
      where p.id = book_photos.book_project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "book_photos_insert_own" on public.book_photos;
create policy "book_photos_insert_own" on public.book_photos
  for insert with check (
    exists (
      select 1 from public.book_projects p
      where p.id = book_photos.book_project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "book_photos_update_own" on public.book_photos;
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

drop policy if exists "book_photos_delete_own" on public.book_photos;
create policy "book_photos_delete_own" on public.book_photos
  for delete using (
    public.is_admin() or exists (
      select 1 from public.book_projects p
      where p.id = book_photos.book_project_id and p.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on table public.book_photos to authenticated;
grant all on table public.book_photos to service_role;

-- ---------------------------------------------------------------------------
-- generated_pages (FK target used by the book pipeline; create now to avoid
-- the next hard failure when that feature is exercised)
-- ---------------------------------------------------------------------------
create table if not exists public.generated_pages (
  id uuid primary key default gen_random_uuid(),
  book_project_id uuid not null references public.book_projects(id) on delete cascade,
  page_number integer not null,
  game_id text,
  template_id text,
  universe_id text,
  page_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'games'
  ) then
    alter table public.generated_pages drop constraint if exists generated_pages_game_id_fkey;
    alter table public.generated_pages
      add constraint generated_pages_game_id_fkey
      foreign key (game_id) references public.games(id) on delete set null;
  end if;
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'templates'
  ) then
    alter table public.generated_pages drop constraint if exists generated_pages_template_id_fkey;
    alter table public.generated_pages
      add constraint generated_pages_template_id_fkey
      foreign key (template_id) references public.templates(id) on delete set null;
  end if;
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'universes'
  ) then
    alter table public.generated_pages drop constraint if exists generated_pages_universe_id_fkey;
    alter table public.generated_pages
      add constraint generated_pages_universe_id_fkey
      foreign key (universe_id) references public.universes(id) on delete set null;
  end if;
end $$;

create index if not exists generated_pages_project_idx on public.generated_pages (book_project_id);

drop trigger if exists set_generated_pages_updated_at on public.generated_pages;
create trigger set_generated_pages_updated_at
  before update on public.generated_pages
  for each row execute function public.set_updated_at();

alter table public.generated_pages enable row level security;

drop policy if exists "generated_pages_select_own" on public.generated_pages;
create policy "generated_pages_select_own" on public.generated_pages
  for select using (
    public.is_admin() or exists (
      select 1 from public.book_projects p
      where p.id = generated_pages.book_project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "generated_pages_admin_write" on public.generated_pages;
create policy "generated_pages_admin_write" on public.generated_pages
  for all using (public.is_admin()) with check (public.is_admin());

grant select on table public.generated_pages to authenticated;
grant all on table public.generated_pages to service_role;

-- ---------------------------------------------------------------------------
-- Force PostgREST / Supabase API schema cache refresh
-- (fixes: Could not find the table 'public.book_projects' in the schema cache)
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';
