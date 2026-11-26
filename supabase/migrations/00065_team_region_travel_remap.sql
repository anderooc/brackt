-- brackt - Collegiate club volleyball tournament hub
-- Copyright (C) 2026 Andrew Chang
--
-- Remap schools/teams/tournaments onto the travel-oriented US map, then
-- recreate team_region with only the eight final values.
-- Requires 00064 to have been committed first.

-- Remap scalar region columns onto the travel map.
UPDATE public.schools
SET region = CASE region::text
  WHEN 'south' THEN 'south_central'
  WHEN 'north' THEN 'midwest'
  WHEN 'central' THEN 'midwest'
  WHEN 'east_central' THEN 'midwest'
  WHEN 'east' THEN 'northeast'
  WHEN 'west' THEN 'pacific'
  WHEN 'northwest' THEN 'pacific'
  ELSE region::text
END::public.team_region;

UPDATE public.teams
SET region = CASE region::text
  WHEN 'south' THEN 'south_central'
  WHEN 'north' THEN 'midwest'
  WHEN 'central' THEN 'midwest'
  WHEN 'east_central' THEN 'midwest'
  WHEN 'east' THEN 'northeast'
  WHEN 'west' THEN 'pacific'
  WHEN 'northwest' THEN 'pacific'
  ELSE region::text
END::public.team_region;

UPDATE public.tournaments
SET region = CASE region::text
  WHEN 'south' THEN 'south_central'
  WHEN 'north' THEN 'midwest'
  WHEN 'central' THEN 'midwest'
  WHEN 'east_central' THEN 'midwest'
  WHEN 'east' THEN 'northeast'
  WHEN 'west' THEN 'pacific'
  WHEN 'northwest' THEN 'pacific'
  ELSE region::text
END::public.team_region;

-- Remap region arrays on posting announcements.
UPDATE public.tournament_posting_announcements
SET regions = ARRAY(
  SELECT CASE x::text
    WHEN 'south' THEN 'south_central'
    WHEN 'north' THEN 'midwest'
    WHEN 'central' THEN 'midwest'
    WHEN 'east_central' THEN 'midwest'
    WHEN 'east' THEN 'northeast'
    WHEN 'west' THEN 'pacific'
    WHEN 'northwest' THEN 'pacific'
    ELSE x::text
  END::public.team_region
  FROM unnest(regions) AS x
);

-- Recreate the enum with only the eight travel regions.
ALTER TYPE public.team_region RENAME TO team_region_old;

CREATE TYPE public.team_region AS ENUM (
  'new_england',
  'northeast',
  'mid_atlantic',
  'southeast',
  'midwest',
  'south_central',
  'mountain',
  'pacific'
);

ALTER TABLE public.schools
  ALTER COLUMN region TYPE public.team_region
  USING region::text::public.team_region;

ALTER TABLE public.teams
  ALTER COLUMN region TYPE public.team_region
  USING region::text::public.team_region;

ALTER TABLE public.tournaments
  ALTER COLUMN region TYPE public.team_region
  USING region::text::public.team_region;

ALTER TABLE public.tournament_posting_announcements
  ALTER COLUMN regions TYPE public.team_region[]
  USING regions::text[]::public.team_region[];

DROP TYPE public.team_region_old;
