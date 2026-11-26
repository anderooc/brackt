-- brackt - Collegiate club volleyball tournament hub
-- Copyright (C) 2026 Andrew Chang
--
-- Add travel-map enum labels. Must commit before remap (00065): Postgres
-- forbids using a newly added enum value in the same transaction.

ALTER TYPE public.team_region ADD VALUE IF NOT EXISTS 'new_england';
ALTER TYPE public.team_region ADD VALUE IF NOT EXISTS 'mid_atlantic';
ALTER TYPE public.team_region ADD VALUE IF NOT EXISTS 'midwest';
ALTER TYPE public.team_region ADD VALUE IF NOT EXISTS 'south_central';
ALTER TYPE public.team_region ADD VALUE IF NOT EXISTS 'mountain';
ALTER TYPE public.team_region ADD VALUE IF NOT EXISTS 'pacific';
