
CREATE OR REPLACE FUNCTION public.touch_streak()
RETURNS TABLE(current_streak int, longest_streak int, last_visit_date date)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  today date := (now() AT TIME ZONE 'UTC')::date;
  prev date;
  cur int;
  lng int;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT p.last_visit_date, p.current_streak, p.longest_streak
    INTO prev, cur, lng
  FROM public.profiles p WHERE p.id = uid;

  IF prev IS NULL THEN
    cur := 1;
  ELSIF prev = today THEN
    cur := COALESCE(cur, 1);
  ELSIF prev = today - INTERVAL '1 day' THEN
    cur := COALESCE(cur, 0) + 1;
  ELSE
    cur := 1;
  END IF;

  IF cur > COALESCE(lng, 0) THEN
    lng := cur;
  END IF;

  UPDATE public.profiles
     SET last_visit_date = today,
         current_streak = cur,
         longest_streak = lng
   WHERE id = uid;

  RETURN QUERY SELECT cur, lng, today;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.touch_streak() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_streak() TO authenticated;
