-- brackt - Collegiate club volleyball tournament hub
-- Copyright (C) 2026 Andrew Chang
--
-- Jersey number chosen when a captain invites a player by email, applied to
-- the roster row once the invite is accepted.

ALTER TABLE public.member_invites
  ADD COLUMN IF NOT EXISTS jersey_number integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'member_invites_jersey_number_range'
  ) THEN
    ALTER TABLE public.member_invites
      ADD CONSTRAINT member_invites_jersey_number_range CHECK (
        jersey_number IS NULL OR (jersey_number >= 0 AND jersey_number <= 99)
      );
  END IF;
END $$;
