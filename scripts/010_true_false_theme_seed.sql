-- Migration 010: seed TRUE_FALSE_THEME (reuses TRUE_FALSE_01 template).
-- Idempotent.

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
