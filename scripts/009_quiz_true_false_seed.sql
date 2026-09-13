-- Migration 009: seed QUIZ + TRUE_FALSE games and templates.
-- Idempotent so it can be replayed safely.

-- GAMES ---------------------------------------------------------------------
insert into public.games
  (id, name, family, personalization_type, technical_engine,
   min_difficulty, max_difficulty, max_per_book, correction_required, active)
values
  ('QUIZ_PERSONAL', 'Quiz personnalisé', 'QUIZ', 'PERSONAL', 'QUIZ',
   1, 4, 1, true, true),
  ('QUIZ_THEME', 'Quiz thématique', 'QUIZ', 'THEME', 'QUIZ',
   1, 4, 1, true, true),
  ('TRUE_FALSE_PERSONAL', 'Vrai ou faux personnalisé', 'QUIZ', 'PERSONAL', 'TRUE_FALSE',
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
insert into public.templates
  (id, name, game_id, technical_engine, structure_key, active)
values
  ('QUIZ_01', 'Quiz — Template 01', null, 'QUIZ', 'QUIZ_01', true),
  ('TRUE_FALSE_01', 'Vrai ou faux — Template 01', null, 'TRUE_FALSE', 'TRUE_FALSE_01', true)
on conflict (id) do update set
  name = excluded.name,
  game_id = excluded.game_id,
  technical_engine = excluded.technical_engine,
  structure_key = excluded.structure_key,
  active = excluded.active;
