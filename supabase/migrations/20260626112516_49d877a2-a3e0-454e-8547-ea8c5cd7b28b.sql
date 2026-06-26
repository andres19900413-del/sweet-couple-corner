CREATE TABLE public.moods (
  user_id uuid NOT NULL PRIMARY KEY,
  mood_value integer NOT NULL DEFAULT 50 CHECK (mood_value >= 0 AND mood_value <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.moods TO authenticated;
GRANT ALL ON public.moods TO service_role;

ALTER TABLE public.moods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read moods" ON public.moods FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert own mood" ON public.moods FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "auth update own mood" ON public.moods FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "auth delete own mood" ON public.moods FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_moods_updated_at BEFORE UPDATE ON public.moods
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.moods;
ALTER TABLE public.moods REPLICA IDENTITY FULL;