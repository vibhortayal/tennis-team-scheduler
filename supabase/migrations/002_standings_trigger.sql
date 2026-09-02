-- Migration 002: standings auto-update trigger
-- Recomputes public.team_standings whenever a dashboard_match is
-- inserted, updated, or deleted, using only completed matches with
-- valid parseable result strings.
--
-- Security:
--  - Function runs as SECURITY DEFINER so it can write to team_standings
--    without requiring public INSERT/UPDATE grants.
--  - search_path is locked to public to prevent search-path-injection.
--  - RLS on team_standings is NOT changed; anon/authenticated SELECT is
--    preserved; no public write policies are added.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Helper: parse a result string "A-B, C-D[, E-F]" into set scores.
-- Returns NULL for unparseable strings.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.parse_result_sets(
  p_result text
)
RETURNS TABLE(
  set_num   int,
  score_a   int,
  score_b   int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parts  text[];
  part   text;
  nums   text[];
  i      int := 1;
BEGIN
  parts := string_to_array(p_result, ',');
  IF array_length(parts, 1) < 2 OR array_length(parts, 1) > 3 THEN
    RETURN;
  END IF;

  FOREACH part IN ARRAY parts LOOP
    nums := regexp_match(trim(part), '^(\d+)-(\d+)$');
    IF nums IS NULL THEN
      RETURN; -- unparseable
    END IF;
    set_num  := i;
    score_a  := nums[1]::int;
    score_b  := nums[2]::int;
    i        := i + 1;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- Helper: determine match winner from a result string ('a', 'b', or NULL).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.result_winner(
  p_result text
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a_wins int := 0;
  b_wins int := 0;
  r      RECORD;
BEGIN
  IF p_result IS NULL OR trim(p_result) = '' THEN
    RETURN NULL;
  END IF;

  FOR r IN SELECT * FROM public.parse_result_sets(p_result) LOOP
    IF r.score_a > r.score_b THEN a_wins := a_wins + 1;
    ELSIF r.score_b > r.score_a THEN b_wins := b_wins + 1;
    ELSE RETURN NULL; -- tied set — invalid
    END IF;
  END LOOP;

  IF a_wins = 0 AND b_wins = 0 THEN RETURN NULL; END IF; -- no rows parsed
  IF a_wins >= 2 THEN RETURN 'a';
  ELSIF b_wins >= 2 THEN RETURN 'b';
  ELSE RETURN NULL;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Main recompute function — rebuilds all rows in team_standings from scratch
-- for every group, based solely on completed scored matches.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recompute_team_standings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_matches_a CONSTANT int := 5;
  total_matches_b CONSTANT int := 6;
  r               RECORD;
  v_games_won     int;
  v_games_lost    int;
  v_wins          int;
  v_losses        int;
  v_rank          int;
BEGIN
  -- Process each row in team_standings
  FOR r IN
    SELECT id, league_group, team_number
    FROM public.team_standings
    ORDER BY league_group, team_number::int
  LOOP
    v_games_won  := 0;
    v_games_lost := 0;
    v_wins       := 0;
    v_losses     := 0;

    -- Iterate over all completed matches that involve this team
    DECLARE
      m    RECORD;
      is_a bool;
      win  text;
      s    RECORD;
    BEGIN
      FOR m IN
        SELECT dm.matchup, dm.result, dm.league_group
        FROM   public.dashboard_matches dm
        WHERE  dm.status = 'Completed'
          AND  dm.result IS NOT NULL
          AND  trim(dm.result) <> ''
          AND  (dm.league_group = r.league_group OR
                (dm.league_group IS NULL AND r.league_group = 'Group B'))
          AND  (
                 dm.matchup LIKE '%Team #' || r.team_number || ' %'
              OR dm.matchup LIKE '%Team #' || r.team_number
              OR dm.matchup LIKE '% Team #' || r.team_number || ' %'
              OR dm.matchup LIKE '% Team #' || r.team_number
               )
      LOOP
        -- Determine if this team is "team A" (first in matchup string)
        is_a := (m.matchup ~* ('^\s*Team\s+#' || r.team_number || '(\s|vs|$)'));

        win := public.result_winner(m.result);

        IF win IS NULL THEN CONTINUE; END IF;

        IF (win = 'a' AND is_a) OR (win = 'b' AND NOT is_a) THEN
          v_wins := v_wins + 1;
        ELSE
          v_losses := v_losses + 1;
        END IF;

        -- Sum games
        FOR s IN SELECT * FROM public.parse_result_sets(m.result) LOOP
          IF is_a THEN
            v_games_won  := v_games_won  + s.score_a;
            v_games_lost := v_games_lost + s.score_b;
          ELSE
            v_games_won  := v_games_won  + s.score_b;
            v_games_lost := v_games_lost + s.score_a;
          END IF;
        END LOOP;
      END LOOP;
    END;

    UPDATE public.team_standings
    SET
      matches_played    = v_wins + v_losses,
      matches_remaining = CASE r.league_group
                            WHEN 'Group A' THEN total_matches_a - (v_wins + v_losses)
                            ELSE                total_matches_b - (v_wins + v_losses)
                          END,
      matches_won       = v_wins,
      matches_lost      = v_losses,
      total_points      = v_wins * 2,
      net_score_rate    = v_games_won - v_games_lost,
      games_won         = v_games_won,
      games_lost        = v_games_lost
    WHERE id = r.id;
  END LOOP;

  -- Assign group_rank within each group
  FOR r IN
    SELECT league_group, team_number,
           ROW_NUMBER() OVER (
             PARTITION BY league_group
             ORDER BY
               total_points     DESC,
               net_score_rate   DESC,
               matches_won      DESC,
               team_number::int ASC
           ) AS rn
    FROM public.team_standings
  LOOP
    UPDATE public.team_standings
    SET group_rank = r.rn
    WHERE league_group = r.league_group
      AND team_number  = r.team_number;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- Trigger function — called after any INSERT, UPDATE, or DELETE on
-- dashboard_matches.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_refresh_standings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recompute_team_standings();
  RETURN NULL;
END;
$$;

-- Drop and recreate trigger to make this migration idempotent
DROP TRIGGER IF EXISTS refresh_standings_on_match_change
  ON public.dashboard_matches;

CREATE TRIGGER refresh_standings_on_match_change
AFTER INSERT OR UPDATE OR DELETE
ON public.dashboard_matches
FOR EACH STATEMENT
EXECUTE FUNCTION public.trg_refresh_standings();

-- Grant EXECUTE on helpers to service_role only (not anon/authenticated);
-- public SELECT on team_standings already exists; no new write grants needed.
REVOKE ALL ON FUNCTION public.parse_result_sets(text)   FROM PUBLIC;
REVOKE ALL ON FUNCTION public.result_winner(text)        FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recompute_team_standings() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_refresh_standings()    FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.parse_result_sets(text)   TO service_role;
GRANT EXECUTE ON FUNCTION public.result_winner(text)        TO service_role;
GRANT EXECUTE ON FUNCTION public.recompute_team_standings() TO service_role;
GRANT EXECUTE ON FUNCTION public.trg_refresh_standings()    TO service_role;

-- No new RLS policies are added.  Existing anon/authenticated SELECT on
-- team_standings is preserved.  No public INSERT/UPDATE/DELETE is granted.
