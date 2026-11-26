-- brackt - Collegiate club volleyball tournament hub
-- Copyright (C) 2026 Andrew Chang
--
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU General Public License as published by
-- the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
--
-- This program is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
-- GNU General Public License for more details.
--
-- You should have received a copy of the GNU General Public License
-- along with this program.  If not, see <https://www.gnu.org/licenses/>.

-- IANA zone the event is played in. Match times are stored as UTC instants and
-- are rendered in this zone wherever the viewer's own zone is not available
-- (server-rendered pages, the PDF packet).
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS time_zone text NOT NULL DEFAULT 'America/New_York';

UPDATE public.tournaments
SET time_zone = CASE region
  WHEN 'west' THEN 'America/Los_Angeles'
  WHEN 'northwest' THEN 'America/Los_Angeles'
  WHEN 'north' THEN 'America/Chicago'
  WHEN 'central' THEN 'America/Chicago'
  WHEN 'south' THEN 'America/Chicago'
  ELSE 'America/New_York'
END;
