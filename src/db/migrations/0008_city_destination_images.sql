-- Refresh destination images to match the new city-level DESTINATIONS list.
-- The lookup in destination-image.ts is an exact match on the destination
-- string, and the list moved from country-level (e.g. "Thailand") to
-- city-level (e.g. "Bangkok, Thailand"), so the previously curated country
-- rows no longer match. Seed a curated Unsplash photo for each active
-- city-level destination.
--
-- All photos are free to use under the Unsplash licence
-- (https://unsplash.com/license). Missing/unknown destinations still fall back
-- to the runtime Unsplash fetch (or the generic fallback image) in
-- destination-image.ts, so this is an enhancement, not a hard dependency.
INSERT INTO "destination_images" ("destination", "image_url", "attribution") VALUES
  ('Bali, Indonesia',          'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1080&q=80&fit=crop', 'Artem Beliaikin'),
  ('Bangkok, Thailand',        'https://images.unsplash.com/photo-1563492065599-3520f775eeed?w=1080&q=80&fit=crop', 'Norbert Braun'),
  ('Barcelona, Spain',         'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=1080&q=80&fit=crop', 'Toa Heftiba'),
  ('Brisbane, Australia',      'https://images.unsplash.com/photo-1566734904496-9309bb1798ae?w=1080&q=80&fit=crop', 'Brisbane City'),
  ('Cap Ferret, France',       'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1080&q=80&fit=crop', 'Sean Oulashin'),
  ('Koh Samui, Thailand',      'https://images.unsplash.com/photo-1528181304800-259b08848526?w=1080&q=80&fit=crop', 'Thomas Jungers'),
  ('Lisbon, Portugal',         'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=1080&q=80&fit=crop', 'Julien Pianetti'),
  ('London, United Kingdom',   'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1080&q=80&fit=crop', 'Benjamin Davies'),
  ('Melbourne, Australia',     'https://images.unsplash.com/photo-1514395462725-fb4566210144?w=1080&q=80&fit=crop', 'Weyne Yew'),
  ('New York, United States',  'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=1080&q=80&fit=crop', 'Patrick Tomasso'),
  ('Norderney, Germany',       'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1080&q=80&fit=crop', 'Sean Oulashin'),
  ('Perth, Australia',         'https://images.unsplash.com/photo-1523482580672-f109ba8cb9be?w=1080&q=80&fit=crop', 'Dan Freeman'),
  ('Phuket, Thailand',         'https://images.unsplash.com/photo-1589394815804-964ed0be2eb5?w=1080&q=80&fit=crop', 'Sumit Chinchane'),
  ('San José, Costa Rica',     'https://images.unsplash.com/photo-1580259679654-9276b39fd2d5?w=1080&q=80&fit=crop', 'Fabian Schneider'),
  ('Santa Teresa, Costa Rica', 'https://images.unsplash.com/photo-1544550581-5f7ceaf7f992?w=1080&q=80&fit=crop', 'Atanas Malamov'),
  ('Sydney, Australia',        'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=1080&q=80&fit=crop', 'Dan Freeman'),
  ('Tokyo, Japan',             'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1080&q=80&fit=crop', 'Jezael Melgoza'),
  ('Vancouver, Canada',        'https://images.unsplash.com/photo-1560814304-4f05b62af116?w=1080&q=80&fit=crop', 'Mike Benna'),
  ('Zürich, Switzerland',      'https://images.unsplash.com/photo-1527668752968-14dc70a27c95?w=1080&q=80&fit=crop', 'Samuel Ferrara')
ON CONFLICT (destination) DO UPDATE
  SET "image_url" = EXCLUDED."image_url",
      "attribution" = EXCLUDED."attribution";
