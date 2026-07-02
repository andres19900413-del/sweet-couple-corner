DROP POLICY "auth update message reactions" ON public.messages;

CREATE POLICY "auth update own messages"
ON public.messages
FOR UPDATE
TO authenticated
USING (auth.uid() = sender_id)
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "auth react to messages"
ON public.messages
FOR UPDATE
TO authenticated
USING (auth.uid() <> sender_id)
WITH CHECK (auth.uid() <> sender_id);

CREATE OR REPLACE FUNCTION public.protect_message_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() <> OLD.sender_id THEN
    IF NEW.content IS DISTINCT FROM OLD.content
       OR NEW.image_url IS DISTINCT FROM OLD.image_url
       OR NEW.audio_url IS DISTINCT FROM OLD.audio_url
       OR NEW.sticker IS DISTINCT FROM OLD.sticker
       OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
       OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
       OR NEW.type IS DISTINCT FROM OLD.type
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Only reactions can be modified on messages you did not send';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.protect_message_fields() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS protect_message_fields_trigger ON public.messages;
CREATE TRIGGER protect_message_fields_trigger
BEFORE UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.protect_message_fields();