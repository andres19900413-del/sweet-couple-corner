
CREATE TABLE public.gifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('photo','letter','sticker')),
  message TEXT,
  image_url TEXT,
  sticker TEXT,
  opened_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gifts TO authenticated;
GRANT ALL ON public.gifts TO service_role;

ALTER TABLE public.gifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth can view gifts" ON public.gifts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Sender can create gifts" ON public.gifts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Sender can delete gifts" ON public.gifts
  FOR DELETE TO authenticated USING (auth.uid() = sender_id);

CREATE POLICY "Recipient can mark opened" ON public.gifts
  FOR UPDATE TO authenticated
  USING (auth.uid() <> sender_id)
  WITH CHECK (auth.uid() <> sender_id);

CREATE POLICY "Sender can update own gift" ON public.gifts
  FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

CREATE OR REPLACE FUNCTION public.protect_gift_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() <> OLD.sender_id THEN
    IF NEW.sender_id IS DISTINCT FROM OLD.sender_id
       OR NEW.kind IS DISTINCT FROM OLD.kind
       OR NEW.message IS DISTINCT FROM OLD.message
       OR NEW.image_url IS DISTINCT FROM OLD.image_url
       OR NEW.sticker IS DISTINCT FROM OLD.sticker
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Only the sender can modify gift contents';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_gift_fields_trg
BEFORE UPDATE ON public.gifts
FOR EACH ROW EXECUTE FUNCTION public.protect_gift_fields();

CREATE OR REPLACE FUNCTION public.on_gift_insert()
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
    'gift',
    NEW.sender_id,
    COALESCE(sender_name, 'Tu osit@') || ' te envió un regalo 🎁',
    'Toca para abrir tu cajita sorpresa ✨',
    '/gifts'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_gift_insert_trg
AFTER INSERT ON public.gifts
FOR EACH ROW EXECUTE FUNCTION public.on_gift_insert();
