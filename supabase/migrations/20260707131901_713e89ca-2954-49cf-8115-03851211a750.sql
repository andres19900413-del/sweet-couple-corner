
-- Streak tracking on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_visit_date date,
  ADD COLUMN IF NOT EXISTS current_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_streak integer NOT NULL DEFAULT 0;

-- Function to bump the caller's streak based on today's visit
CREATE OR REPLACE FUNCTION public.touch_streak()
RETURNS TABLE(current_streak int, longest_streak int, last_visit_date date)
LANGUAGE plpgsql
SECURITY DEFINER
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
    -- already counted today
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

GRANT EXECUTE ON FUNCTION public.touch_streak() TO authenticated;

-- Letters (cofre de cartas / cápsulas del tiempo)
CREATE TABLE public.letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text NOT NULL,
  unlock_at timestamptz NOT NULL,
  opened_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.letters TO authenticated;
GRANT ALL ON public.letters TO service_role;

ALTER TABLE public.letters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read letters" ON public.letters
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth insert own letters" ON public.letters
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);

CREATE POLICY "author update own letters" ON public.letters
  FOR UPDATE TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "recipients can mark opened" ON public.letters
  FOR UPDATE TO authenticated
  USING (unlock_at <= now())
  WITH CHECK (unlock_at <= now());

CREATE POLICY "author delete own letters" ON public.letters
  FOR DELETE TO authenticated USING (auth.uid() = author_id);

CREATE TRIGGER letters_updated_at
  BEFORE UPDATE ON public.letters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX letters_unlock_at_idx ON public.letters (unlock_at);
