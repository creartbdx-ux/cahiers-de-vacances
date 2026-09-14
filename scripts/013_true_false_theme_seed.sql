-- Migration 013: seed TRUE_FALSE_THEME into public.games.
-- Idempotent — safe to re-run.
--
-- Mirrors QUIZ_THEME / WORDSEARCH_THEME / TRUE_FALSE_PERSONAL (scripts/008–009):
-- THEME companion of TRUE_FALSE_PERSONAL, same technical engine TRUE_FALSE,
-- same shared template TRUE_FALSE_01 (engine-scoped, game_id null).

-- GAME ----------------------------------------------------------------------
insert into public.games
  (id, name, family, personalization_type, technical_engine,
   min_difficulty, max_difficulty, max_per_book, correction_required, active)
values
  ('TRUE_FALSE_THEME', 'Vrai ou faux thématique', 'QUIZ', 'THEME', 'TRUE_FALSE',
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

-- TEMPLATE ------------------------------------------------------------------
-- Ensure TRUE_FALSE_01 exists (already seeded in 009; upsert keeps it active).
insert into public.templates
  (id, name, game_id, technical_engine, structure_key, active)
values
  ('TRUE_FALSE_01', 'Vrai ou faux — Template 01', null, 'TRUE_FALSE', 'TRUE_FALSE_01', true)
on conflict (id) do update set
  name = excluded.name,
  game_id = excluded.game_id,
  technical_engine = excluded.technical_engine,
  structure_key = excluded.structure_key,
  active = excluded.active;
