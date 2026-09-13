-- Migration 007: standardise game engines + seed the CROSSWORD library.
-- Applied to Supabase via the MCP; kept here for version control.
-- Idempotent so it can be replayed safely.
--
-- Model evolution: a TEMPLATE is bound to a TECHNICAL ENGINE (the algorithm),
-- not to a single game. Both CROSSWORD_PERSONAL and CROSSWORD_THEME use the
-- CROSSWORD engine, so they share the CROSSWORD_01 template with no duplication.
-- We add `technical_engine` to templates and resolve compatibility through it.

alter table public.templates
  add column if not exists technical_engine text;

create index if not exists templates_technical_engine_idx
  on public.templates (technical_engine);

-- GAMES ---------------------------------------------------------------------
-- Same technical engine (CROSSWORD); only the future content source differs
-- (PERSONAL = personal data, THEME = thematic content).
insert into public.games
  (id, name, family, personalization_type, technical_engine,
   min_difficulty, max_difficulty, max_per_book, correction_required, active)
values
  ('CROSSWORD_PERSONAL', 'Mots croisés personnalisés', 'LETTERS', 'PERSONAL', 'CROSSWORD',
   1, 4, 1, true, true),
  ('CROSSWORD_THEME',    'Mots croisés thématiques',   'LETTERS', 'THEME',    'CROSSWORD',
   1, 4, 1, true, true)
on conflict (id) do update set
  name = excluded.name,
  family = excluded.family,
  personalization_type = excluded.personalization_type,
  technical_engine = excluded.technical_engine,
  min_difficulty = excluded.min_difficulty,
  max_difficulty = excluded.max_difficulty,
  max_per_book = excluded.max_per_book,
  correction_required = excluded.correction_required,
  active = excluded.active;

-- TEMPLATES -----------------------------------------------------------------
-- Engine-scoped (game_id left null): usable by every CROSSWORD game.
insert into public.templates
  (id, name, game_id, technical_engine, structure_key, active)
values
  ('CROSSWORD_01', 'Mots croisés — Template 01', null, 'CROSSWORD', 'CROSSWORD_01', true)
on conflict (id) do update set
  name = excluded.name,
  game_id = excluded.game_id,
  technical_engine = excluded.technical_engine,
  structure_key = excluded.structure_key,
  active = excluded.active;
