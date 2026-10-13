-- Privacy-limited, server-validated activity signals for Super Owner adoption analytics.
-- No page URLs, query strings, content, IP addresses or recruiting records are stored.
CREATE TABLE IF NOT EXISTS public.platform_user_activity (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.platform_user_activity_daily (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_date date NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, activity_date)
);
CREATE INDEX IF NOT EXISTS idx_platform_user_activity_daily_date
  ON public.platform_user_activity_daily (activity_date DESC, user_id);
ALTER TABLE public.platform_user_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_user_activity_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_user_activity FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.platform_user_activity_daily FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.platform_user_activity TO service_role;
GRANT ALL ON public.platform_user_activity_daily TO service_role;

-- The signed-in user may record their own coarse activity, but cannot choose a
-- user ID or read anyone's activity. A five-minute server-side limit bounds writes.
CREATE OR REPLACE FUNCTION public.record_platform_activity()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_day date := (v_now AT TIME ZONE 'UTC')::date;
  v_recorded uuid;
BEGIN
  IF v_user IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_user AND account_status = 'active' AND registration_status = 'active'
  ) THEN RETURN; END IF;

  INSERT INTO public.platform_user_activity (user_id, first_seen_at, last_seen_at)
  VALUES (v_user, v_now, v_now)
  ON CONFLICT (user_id) DO UPDATE
    SET last_seen_at = EXCLUDED.last_seen_at
    WHERE platform_user_activity.last_seen_at <= v_now - interval '5 minutes'
       OR (platform_user_activity.last_seen_at AT TIME ZONE 'UTC')::date <> v_day
  RETURNING user_id INTO v_recorded;

  IF v_recorded IS NULL THEN RETURN; END IF;
  INSERT INTO public.platform_user_activity_daily (user_id, activity_date, first_seen_at, last_seen_at)
  VALUES (v_user, v_day, v_now, v_now)
  ON CONFLICT (user_id, activity_date) DO UPDATE
    SET last_seen_at = EXCLUDED.last_seen_at;
END;
$$;
REVOKE ALL ON FUNCTION public.record_platform_activity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_platform_activity() TO authenticated;
