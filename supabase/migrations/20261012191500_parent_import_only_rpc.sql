-- Parents may contribute existing recruiting history for an approved athlete.
-- They do not receive INSERT, UPDATE or DELETE privileges on recruiting tables.
-- This narrow, authenticated import-only RPC is the sole parent write entrypoint.
BEGIN;

DROP POLICY IF EXISTS "parents import linked college relationships" ON public.athlete_colleges;
DROP POLICY IF EXISTS "parents import linked coach relationships" ON public.athlete_coaches;
DROP POLICY IF EXISTS "parents import linked interactions" ON public.interactions;

CREATE OR REPLACE FUNCTION public.parent_import_recruiting_history_row(
  p_athlete_user_id uuid,
  p_college_id uuid,
  p_coach_id uuid DEFAULT NULL,
  p_type text DEFAULT NULL,
  p_date date DEFAULT NULL,
  p_date_precision text DEFAULT 'unknown',
  p_date_year integer DEFAULT NULL,
  p_date_month integer DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_create_interaction boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_type text := btrim(coalesce(p_type, ''));
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_initiated_by text;
BEGIN
  IF v_user_id IS NULL
    OR NOT public.registration_is_active()
    OR NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = v_user_id AND p.app_role = 'parent'
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.parent_guardian_access pga
      WHERE pga.parent_user_id = v_user_id
        AND pga.athlete_user_id = p_athlete_user_id
        AND pga.status = 'active'
    )
  THEN
    RAISE EXCEPTION 'Import requires an active, approved Parent / Guardian connection'
      USING ERRCODE = '42501';
  END IF;

  IF p_college_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.colleges c WHERE c.id = p_college_id
  ) THEN
    RAISE EXCEPTION 'Select a valid school for the import';
  END IF;

  IF p_coach_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.college_coaches cc
    WHERE cc.id = p_coach_id AND cc.college_id = p_college_id
  ) THEN
    RAISE EXCEPTION 'The selected coach does not belong to the selected school';
  END IF;

  IF p_create_interaction THEN
    IF left(lower(v_type), 9) <> 'imported ' OR length(v_type) > 120 THEN
      RAISE EXCEPTION 'Only imported recruiting-history activity may be added';
    END IF;
    IF length(coalesce(v_note, '')) > 10000 THEN
      RAISE EXCEPTION 'Imported notes must be 10,000 characters or fewer';
    END IF;
    IF p_date_precision IS NULL OR p_date_precision NOT IN ('exact', 'month', 'year', 'unknown')
      OR (p_date_year IS NOT NULL AND p_date_year NOT BETWEEN 1900 AND 2100)
      OR (p_date_month IS NOT NULL AND p_date_month NOT BETWEEN 1 AND 12)
    THEN
      RAISE EXCEPTION 'Invalid imported recruiting date';
    END IF;
  END IF;

  -- Insert-only: preserve existing athlete pipeline status, notes and relationships.
  INSERT INTO public.athlete_colleges (athlete_user_id, college_id, status)
  VALUES (p_athlete_user_id, p_college_id, 'Researching')
  ON CONFLICT (athlete_user_id, college_id) DO NOTHING;

  IF p_coach_id IS NOT NULL THEN
    INSERT INTO public.athlete_coaches (athlete_user_id, coach_id, college_id)
    VALUES (p_athlete_user_id, p_coach_id, p_college_id)
    ON CONFLICT (athlete_user_id, coach_id) DO NOTHING;
  END IF;

  IF p_create_interaction THEN
    IF EXISTS (
      SELECT 1 FROM public.interactions i
      WHERE i.athlete_user_id = p_athlete_user_id
        AND i.college_id = p_college_id
        AND i.type = v_type
        AND i.date IS NOT DISTINCT FROM p_date
        AND i.note IS NOT DISTINCT FROM v_note
    ) THEN
      RETURN jsonb_build_object('duplicate', true);
    END IF;

    v_initiated_by := CASE WHEN v_type ~* '(received|reply|respond)' THEN 'Coach' ELSE 'Athlete' END;
    INSERT INTO public.interactions (
      athlete_user_id, actor_user_id, college_id, coach_id, type,
      initiated_by, date, date_precision, date_year, date_month, note
    )
    VALUES (
      p_athlete_user_id, v_user_id, p_college_id, p_coach_id, v_type,
      v_initiated_by, p_date, p_date_precision, p_date_year, p_date_month, v_note
    );
  END IF;

  RETURN jsonb_build_object('duplicate', false);
END;
$function$;

REVOKE ALL ON FUNCTION public.parent_import_recruiting_history_row(
  uuid, uuid, uuid, text, date, text, integer, integer, text, boolean
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.parent_import_recruiting_history_row(
  uuid, uuid, uuid, text, date, text, integer, integer, text, boolean
) FROM anon;
GRANT EXECUTE ON FUNCTION public.parent_import_recruiting_history_row(
  uuid, uuid, uuid, text, date, text, integer, integer, text, boolean
) TO authenticated;

COMMIT;
