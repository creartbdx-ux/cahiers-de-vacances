-- Migration 008: seed the WORDSEARCH games + shared template.
-- Idempotent so it can be replayed safely.
--
-- Same pattern as CROSSWORD: PERSONAL and THEME share the WORDSEARCH technical
-- engine and therefore the same WORDSEARCH_01 template (no duplication).

-- GAMES ---------------------------------------------------------------------
insert into public.games
  (id, name, family, personalization_type, technical_engine,
   min_difficulty, max_difficulty, max_per_book, correction_required, active)
values
  ('WORDSEARCH_PERSONAL', 'Mots mêlés personnalisés', 'LETTERS', 'PERSONAL', 'WORDSEARCH',
   1, 4, 1, true, true),
  ('WORDSEARCH_THEME',    'Mots mêlés thématiques',   'LETTERS', 'THEME',    'WORDSEARCH',
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
-- Engine-scoped (game_id left null): usable by every WORDSEARCH game.
insert into public.templates
  (id, name, game_id, technical_engine, structure_key, active)
values
  ('WORDSEARCH_01', 'Mots mêlés — Template 01', null, 'WORDSEARCH', 'WORDSEARCH_01', true)
on conflict (id) do update set
  name = excluded.name,
  game_id = excluded.game_id,
  technical_engine = excluded.technical_engine,
  structure_key = excluded.structure_key,
  active = excluded.active;
