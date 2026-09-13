-- Migration 005: seed the graphic-engine reference library.
-- Idempotent (ON CONFLICT ... DO UPDATE) so it can be replayed safely.

insert into public.palettes (id, name, primary_color, secondary_color, accent_color, background_color, text_color, active) values
  ('BLUE',          'Bleu',                  '#4F7CAC', '#9FC5E8', '#E7B66B', '#F5F9FC', '#243447', true),
  ('GREEN',         'Vert',                  '#628C6A', '#A8C5A2', '#E0A458', '#F5F8F1', '#304033', true),
  ('PINK',          'Rose',                  '#D66F9B', '#F1B5CD', '#E7A15B', '#FFF5F8', '#503541', true),
  ('PURPLE',        'Violet',                '#7B63A5', '#B9A7D3', '#E4B55F', '#F8F5FB', '#372D45', true),
  ('RED',           'Rouge',                 '#C95656', '#E6A0A0', '#E8B45C', '#FFF5F3', '#492E2E', true),
  ('ORANGE',        'Orange',                '#E9793D', '#E7A06B', '#F1C453', '#FFF5EA', '#57392A', true),
  ('YELLOW',        'Jaune',                 '#E3B83E', '#F1D477', '#D77D47', '#FFFBEF', '#4D4128', true),
  ('NATURAL_BEIGE', 'Tons naturels / beige', '#B29A78', '#D8C7A8', '#7E9875', '#F7F2E8', '#40382F', true),
  ('BLACK_WHITE',   'Noir et blanc',         '#222222', '#777777', '#BDBDBD', '#FAFAFA', '#181818', true)
on conflict (id) do update set
  name = excluded.name,
  primary_color = excluded.primary_color,
  secondary_color = excluded.secondary_color,
  accent_color = excluded.accent_color,
  background_color = excluded.background_color,
  text_color = excluded.text_color,
  active = excluded.active;

insert into public.styles (id, name, description, decor_density, active) values
  ('POP',        'Pop & coloré',      'Style énergique, joyeux et graphique, avec formes arrondies, stickers et illustrations simples.',                       'high',   true),
  ('RETRO',      'Vacances rétro',    'Style chaleureux et nostalgique inspiré des anciens cahiers de vacances et affiches de voyage rétro.',                 'medium', true),
  ('MINIMAL',    'Chic & minimal',    'Style adulte, élégant et épuré avec beaucoup d''espace blanc et peu de décoration.',                                    'low',    true),
  ('NATURE',     'Nature & doux',     'Style organique, calme et chaleureux utilisant des formes douces et des éléments inspirés de la nature.',                'medium', true),
  ('ILLUSTRATED','Créatif & illustré','Style artistique riche en illustrations avec compositions libres et expressives.',                                      'high',   true),
  ('FUN',        'Fun & décalé',      'Style ludique, humoristique et légèrement inattendu avec compositions asymétriques et éléments graphiques expressifs.', 'high',   true)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  decor_density = excluded.decor_density,
  active = excluded.active;

insert into public.universes (id, name, active) values
  ('TRAVEL',           'Voyage',                 true),
  ('BEACH',            'Plage',                  true),
  ('MOUNTAIN',         'Montagne',               true),
  ('BIKE',             'Vélo',                   true),
  ('RUNNING',          'Course à pied',          true),
  ('FITNESS',          'Fitness',                true),
  ('FOOTBALL',         'Football',               true),
  ('WINTER_SPORTS',    'Sports d''hiver',        true),
  ('FASHION',          'Mode',                   true),
  ('BEAUTY',           'Beauté',                 true),
  ('DECOR',            'Décoration',             true),
  ('FOOD',             'Gastronomie',            true),
  ('FOOD_COOKING',     'Cuisine',                true),
  ('FOOD_BAKING',      'Pâtisserie',             true),
  ('FOOD_RESTAURANTS', 'Restaurants',            true),
  ('FOOD_DISCOVERY',   'Découvertes culinaires', true),
  ('FOOD_LOVER',       'Gourmandise',            true),
  ('COFFEE',           'Café',                   true),
  ('PARTY',            'Fête',                   true),
  ('MUSIC',            'Musique',                true),
  ('CINEMA',           'Cinéma',                 true),
  ('BOOKS',            'Lecture',                true),
  ('GAMING',           'Jeux vidéo',             true),
  ('ART',              'Art',                    true),
  ('PHOTOGRAPHY',      'Photographie',           true),
  ('ANIMALS',          'Animaux',                true),
  ('NATURE',           'Nature',                 true),
  ('WELLNESS',         'Bien-être',              true)
on conflict (id) do update set
  name = excluded.name,
  active = excluded.active;
