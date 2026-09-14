-- Migration 012: editorial configuration for universes (content-generation frame).
-- Idempotent — safe to run in Supabase SQL Editor.
-- Does not change universe ids. Existing rows keep working with empty defaults.

alter table public.universes
  add column if not exists editorial_description text;

alter table public.universes
  add column if not exists allowed_topics text[] not null default '{}';

alter table public.universes
  add column if not exists excluded_topics text[] not null default '{}';

alter table public.universes
  add column if not exists quiz_guidance text;

-- Minimal public descriptions for existing universes (no ultra-detailed topic lists).
-- Only fills empty editorial_description so admin edits are preserved on re-run.
update public.universes set editorial_description = v.desc
from (values
  ('TRAVEL', 'Univers autour du voyage, des destinations et des cultures croisées.'),
  ('BEACH', 'Univers autour de la plage, du littoral et des vacances balnéaires.'),
  ('MOUNTAIN', 'Univers autour de la montagne, des sommets et des paysages d''altitude.'),
  ('BIKE', 'Univers autour du vélo et de la culture cycliste.'),
  ('RUNNING', 'Univers autour de la course à pied et de l''entraînement.'),
  ('FITNESS', 'Univers autour du fitness et de l''entraînement physique.'),
  ('FOOTBALL', 'Univers autour du football et de sa culture.'),
  ('WINTER_SPORTS', 'Univers autour des sports d''hiver.'),
  ('FASHION', 'Univers autour de la mode, du style vestimentaire et des tendances fashion.'),
  ('DECOR', 'Univers autour de la décoration et de l''aménagement d''intérieur.'),
  ('FOOD', 'Univers autour de la gastronomie et de la culture culinaire.'),
  ('FOOD_COOKING', 'Univers autour de la cuisine et des techniques de préparation.'),
  ('FOOD_BAKING', 'Univers autour de la pâtisserie et de la boulangerie.'),
  ('FOOD_RESTAURANTS', 'Univers autour des restaurants et de la culture de table.'),
  ('FOOD_DISCOVERY', 'Univers autour des découvertes culinaires et des saveurs du monde.'),
  ('FOOD_LOVER', 'Univers autour de la gourmandise et du plaisir de manger.'),
  ('COFFEE', 'Univers autour du café et de sa culture.'),
  ('PARTY', 'Univers autour de la fête et des célébrations.'),
  ('MUSIC', 'Univers autour de la musique et de la culture musicale.'),
  ('CINEMA', 'Univers autour du cinéma et des séries.'),
  ('BOOKS', 'Univers autour de la lecture et des livres.'),
  ('GAMING', 'Univers autour des jeux vidéo et de la culture gaming.'),
  ('ART', 'Univers autour des arts plastiques, de la création artistique et des musées.'),
  ('PHOTOGRAPHY', 'Univers autour de la photographie.'),
  ('ANIMALS', 'Univers autour des animaux.'),
  ('NATURE', 'Univers autour de la nature, de la faune, de la flore et des paysages.'),
  ('WELLNESS', 'Univers autour du bien-être, de la détente et des pratiques de ressourcement.')
) as v(id, desc)
where public.universes.id = v.id
  and (public.universes.editorial_description is null
       or btrim(public.universes.editorial_description) = '');

-- BEAUTY: precise editorial frame (validated real case — cosmetics / care, not fine arts).
update public.universes set
  name = 'Beauté',
  editorial_description = 'Univers autour de la beauté, des cosmétiques et des soins personnels.',
  allowed_topics = array[
    'maquillage',
    'skincare',
    'soins du visage',
    'soins du corps',
    'cheveux',
    'coiffure',
    'ongles',
    'parfums',
    'ingrédients cosmétiques',
    'routines beauté',
    'gestes beauté',
    'histoire des cosmétiques',
    'culture beauté',
    'produits iconiques',
    'vocabulaire beauté',
    'cosmétique'
  ]::text[],
  excluded_topics = array[
    'histoire de l''art',
    'peinture',
    'sculpture',
    'architecture',
    'musées',
    'philosophie esthétique',
    'esthétique philosophique',
    'mouvements artistiques',
    'beauté abstraite',
    'esthétique japonaise',
    'histoire du design',
    'renaissance artistique',
    'art nouveau',
    'mode vestimentaire',
    'fashion'
  ]::text[],
  quiz_guidance = 'Interpréter « Beauté » comme cosmétiques / maquillage / skincare / cheveux / parfums / soins — jamais comme art, architecture ou philosophie. MODE/FASHION est un univers séparé : ne pas transformer ce quiz en quiz mode. Faits stables uniquement. Pas de conseil médical, pas de diagnostic, pas de claims santé douteux.'
where id = 'BEAUTY';
