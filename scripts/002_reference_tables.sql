-- Migration 002: graphic-engine reference tables (admin-managed library).
-- Applied to Supabase via the MCP; kept here for version control.
-- RLS: everyone may read, only admins may write.

create table if not exists public.palettes (
  id text primary key,
  name text not null,
  primary_color text not null,
  secondary_color text not null,
  accent_color text not null,
  background_color text not null,
  text_color text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.styles (
  id text primary key,
  name text not null,
  description text,
  typography_title text,
  typography_body text,
  decor_density text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.universes (
  id text primary key,
  name text not null,
  category text,
  editorial_description text,
  allowed_topics text[] not null default '{}',
  excluded_topics text[] not null default '{}',
  quiz_guidance text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assets (
  id text primary key,
  name text not null,
  universe_id text references public.universes(id) on delete set null,
  style_id text references public.styles(id) on delete set null,
  asset_type text not null check (asset_type in ('ICON', 'DECOR', 'HERO')),
  svg_storage_path text not null,
  recolorable boolean not null default true,
  color_slots text[] not null default '{}',
  priority integer not null default 3,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'VALIDATED', 'REJECTED')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  validated_at timestamptz,
  validated_by uuid references auth.users(id) on delete set null
);

create index if not exists assets_universe_id_idx on public.assets (universe_id);
create index if not exists assets_style_id_idx on public.assets (style_id);
create index if not exists assets_usable_idx on public.assets (status, active);

create table if not exists public.games (
  id text primary key,
  name text not null,
  family text not null,
  personalization_type text not null,
  technical_engine text,
  min_difficulty integer not null,
  max_difficulty integer not null,
  max_per_book integer not null,
  correction_required boolean not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.templates (
  id text primary key,
  name text not null,
  game_id text references public.games(id) on delete set null,
  structure_key text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists templates_game_id_idx on public.templates (game_id);

create trigger set_palettes_updated_at before update on public.palettes
  for each row execute function public.set_updated_at();
create trigger set_styles_updated_at before update on public.styles
  for each row execute function public.set_updated_at();
create trigger set_universes_updated_at before update on public.universes
  for each row execute function public.set_updated_at();
create trigger set_assets_updated_at before update on public.assets
  for each row execute function public.set_updated_at();
create trigger set_games_updated_at before update on public.games
  for each row execute function public.set_updated_at();
create trigger set_templates_updated_at before update on public.templates
  for each row execute function public.set_updated_at();

alter table public.palettes enable row level security;
alter table public.styles enable row level security;
alter table public.universes enable row level security;
alter table public.assets enable row level security;
alter table public.games enable row level security;
alter table public.templates enable row level security;

create policy "palettes_read_all" on public.palettes for select using (true);
create policy "palettes_admin_write" on public.palettes for all
  using (public.is_admin()) with check (public.is_admin());

create policy "styles_read_all" on public.styles for select using (true);
create policy "styles_admin_write" on public.styles for all
  using (public.is_admin()) with check (public.is_admin());

create policy "universes_read_all" on public.universes for select using (true);
create policy "universes_admin_write" on public.universes for all
  using (public.is_admin()) with check (public.is_admin());

create policy "assets_read_all" on public.assets for select using (true);
create policy "assets_admin_write" on public.assets for all
  using (public.is_admin()) with check (public.is_admin());

create policy "games_read_all" on public.games for select using (true);
create policy "games_admin_write" on public.games for all
  using (public.is_admin()) with check (public.is_admin());

create policy "templates_read_all" on public.templates for select using (true);
create policy "templates_admin_write" on public.templates for all
  using (public.is_admin()) with check (public.is_admin());
