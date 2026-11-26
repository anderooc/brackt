-- brackt - Collegiate club volleyball tournament hub
-- Copyright (C) 2026 Andrew Chang
--
-- Replace overlapping team_region values with a travel-oriented US map
-- (New England, Northeast, Mid-Atlantic, Southeast, Midwest, South Central,
-- Mountain, Pacific). Remap existing rows, then recreate the enum cleanly.

-- New labels (northeast / southeast already exist).
ALTER TYPE public.team_region ADD VALUE IF NOT EXISTS 'new_england';
ALTER TYPE public.team_region ADD VALUE IF NOT EXISTS 'mid_atlantic';
ALTER TYPE public.team_region ADD VALUE IF NOT EXISTS 'midwest';
ALTER TYPE public.team_region ADD VALUE IF NOT EXISTS 'south_central';
ALTER TYPE public.team_region ADD VALUE IF NOT EXISTS 'mountain';
ALTER TYPE public.team_region ADD VALUE IF NOT EXISTS 'pacific';

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
