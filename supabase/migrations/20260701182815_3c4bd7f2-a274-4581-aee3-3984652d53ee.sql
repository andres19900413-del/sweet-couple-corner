
CREATE TABLE public.thoughts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seen BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.thoughts TO authenticated;
GRANT ALL ON public.thoughts TO service_role;

ALTER TABLE public.thoughts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read thoughts" ON public.thoughts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert own thoughts" ON public.thoughts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Authenticated can update thoughts" ON public.thoughts
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX thoughts_unseen_idx ON public.thoughts (created_at DESC) WHERE seen = false;

ALTER PUBLICATION supabase_realtime ADD TABLE public.thoughts;

CREATE OR REPLACE FUNCTION public.on_thought_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name TEXT;
BEGIN
  SELECT display_name INTO sender_name FROM public.profiles WHERE id = NEW.sender_id;
  PERFORM public.notify_push(
    'thought',
    NEW.sender_id,
    COALESCE(sender_name, 'Tu osit@') || ' está pensando en ti 💭',
    '¡Un abrazo virtual acaba de llegar! 💕',
    '/'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_thought_insert_trigger
AFTER INSERT ON public.thoughts
FOR EACH ROW EXECUTE FUNCTION public.on_thought_insert();
