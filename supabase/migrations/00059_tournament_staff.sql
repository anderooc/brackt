-- brackt - Collegiate club volleyball tournament hub
-- Copyright (C) 2026 Andrew Chang
--
-- Co-host / staff roles for tournament host operations.

CREATE TABLE IF NOT EXISTS tournament_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'co_host'
    CHECK (role IN ('co_host', 'staff')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT tournament_staff_tournament_user_unique UNIQUE (tournament_id, user_id)
);

CREATE INDEX IF NOT EXISTS tournament_staff_tournament_id_idx
  ON tournament_staff (tournament_id);
CREATE INDEX IF NOT EXISTS tournament_staff_user_id_idx
  ON tournament_staff (user_id);
CREATE INDEX IF NOT EXISTS tournament_staff_created_by_user_id_idx
  ON tournament_staff (created_by_user_id);

ALTER TABLE tournament_staff ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.tournament_staff FROM anon, authenticated;

-- Staff count as hosts for Realtime chat / match visibility helpers.
CREATE OR REPLACE FUNCTION app_private.current_user_can_access_tournament_chat(
  target_tournament_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    JOIN public.tournaments t ON t.id = target_tournament_id
    WHERE u.auth_id = (SELECT auth.uid()::text)
      AND u.disabled_at IS NULL
      AND (
        t.organizer_id = u.id
        OR u.role = 'admin'
        OR EXISTS (
          SELECT 1
          FROM public.tournament_staff ts
          WHERE ts.tournament_id = t.id
            AND ts.user_id = u.id
        )
        OR EXISTS (
          SELECT 1
          FROM public.school_members sm
          WHERE sm.school_id = t.host_school_id
            AND sm.user_id = u.id
            AND sm.role IN ('president', 'officer')
        )
        OR EXISTS (
          SELECT 1
          FROM public.registrations r
          JOIN public.team_members tm ON tm.team_id = r.team_id
          WHERE r.tournament_id = t.id
            AND tm.user_id = u.id
            AND r.status IN ('confirmed', 'checked_in')
        )
      )
  );
$function$;

CREATE OR REPLACE FUNCTION app_private.current_user_can_view_match(
  target_match_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    JOIN public.matches m ON m.id = target_match_id
    JOIN public.tournaments t ON t.id = m.tournament_id
    LEFT JOIN public.pools p ON p.id = m.pool_id
    LEFT JOIN public.divisions pool_div
      ON pool_div.id = p.division_id
      AND pool_div.tournament_id = t.id
    LEFT JOIN public.brackets b ON b.id = m.bracket_id
    LEFT JOIN public.divisions bracket_div
      ON bracket_div.id = b.division_id
      AND bracket_div.tournament_id = t.id
    WHERE u.auth_id = (SELECT auth.uid()::text)
      AND u.disabled_at IS NULL
      AND (
        t.organizer_id = u.id
        OR u.role = 'admin'
        OR EXISTS (
          SELECT 1
          FROM public.tournament_staff ts
          WHERE ts.tournament_id = t.id
            AND ts.user_id = u.id
        )
        OR EXISTS (
          SELECT 1
          FROM public.school_members sm
          WHERE sm.school_id = t.host_school_id
            AND sm.user_id = u.id
            AND sm.role IN ('president', 'officer')
        )
        OR (
          (
            pool_div.pools_released_at IS NOT NULL
            OR bracket_div.pools_released_at IS NOT NULL
          )
          AND (
            t.status <> 'draft'
            OR EXISTS (
              SELECT 1
              FROM public.school_members sm
              WHERE sm.school_id = t.host_school_id
                AND sm.user_id = u.id
            )
            OR EXISTS (
              SELECT 1
              FROM public.tournament_staff ts
              WHERE ts.tournament_id = t.id
                AND ts.user_id = u.id
            )
          )
        )
      )
  );
$function$;
