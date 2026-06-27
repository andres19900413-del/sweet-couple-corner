CREATE TABLE public.notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id uuid NOT NULL,
  author_name text,
  content text NOT NULL,
  color text NOT NULL DEFAULT 'blush',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;
GRANT ALL ON public.notes TO service_role;

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read notes" ON public.notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert own notes" ON public.notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "author delete own notes" ON public.notes FOR DELETE TO authenticated USING (auth.uid() = author_id);
CREATE POLICY "author update own notes" ON public.notes FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;