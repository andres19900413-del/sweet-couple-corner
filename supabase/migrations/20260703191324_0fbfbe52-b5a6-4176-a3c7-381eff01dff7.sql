ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_messages_reply_to_id ON public.messages(reply_to_id);

CREATE OR REPLACE FUNCTION public.protect_message_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() <> OLD.sender_id THEN
    IF NEW.content IS DISTINCT FROM OLD.content
       OR NEW.image_url IS DISTINCT FROM OLD.image_url
       OR NEW.audio_url IS DISTINCT FROM OLD.audio_url
       OR NEW.sticker IS DISTINCT FROM OLD.sticker
       OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
       OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
       OR NEW.type IS DISTINCT FROM OLD.type
       OR NEW.reply_to_id IS DISTINCT FROM OLD.reply_to_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Only reactions can be modified on messages you did not send';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;