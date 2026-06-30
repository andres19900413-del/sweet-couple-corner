
-- Enable pg_net for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net;

-- push_subscriptions table
CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage their own subscriptions"
  ON public.push_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX push_subscriptions_user_idx ON public.push_subscriptions(user_id);

-- Helper to call the public webhook with a payload
CREATE OR REPLACE FUNCTION public.notify_push(_channel TEXT, _sender UUID, _title TEXT, _body TEXT, _url TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://project--99556691-5643-4d45-97fe-d0782a78716b.lovable.app/api/public/hooks/send-push',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllZnp0bmNuYmJpeXpzZ3Rmb25nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzOTYxMDksImV4cCI6MjA5Nzk3MjEwOX0.bpxvlx7S4Td2znr8_NC0qhmnQ5XzJ_wmFwSMyERu338"}'::jsonb,
    body := jsonb_build_object('channel', _channel, 'sender_id', _sender, 'title', _title, 'body', _body, 'url', _url)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_push(TEXT, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- Trigger: chat messages
CREATE OR REPLACE FUNCTION public.on_message_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name TEXT;
BEGIN
  SELECT display_name INTO sender_name FROM public.profiles WHERE id = NEW.sender_id;
  PERFORM public.notify_push(
    'chat',
    NEW.sender_id,
    COALESCE(sender_name, 'Tu osit@') || ' te escribió 💌',
    COALESCE(LEFT(NEW.content, 80), CASE WHEN NEW.image_url IS NOT NULL THEN '📸 Foto' WHEN NEW.sticker IS NOT NULL THEN NEW.sticker ELSE 'Nuevo mensaje' END),
    '/chat'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER messages_push_trigger
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.on_message_insert();

-- Trigger: notes
CREATE OR REPLACE FUNCTION public.on_note_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_push(
    'notes',
    NEW.author_id,
    COALESCE(NEW.author_name, 'Tu osit@') || ' te dejó una nota 📝',
    LEFT(NEW.content, 100),
    '/memories'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER notes_push_trigger
  AFTER INSERT ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.on_note_insert();

-- Trigger: calendar events
CREATE OR REPLACE FUNCTION public.on_calendar_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  creator_name TEXT;
BEGIN
  SELECT display_name INTO creator_name FROM public.profiles WHERE id = NEW.created_by;
  PERFORM public.notify_push(
    'calendar',
    NEW.created_by,
    'Nueva fecha guardada 📅',
    COALESCE(creator_name, 'Tu osit@') || ' añadió: ' || NEW.title,
    '/calendar'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER calendar_push_trigger
  AFTER INSERT ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.on_calendar_insert();

-- Trigger: moods (insert or update)
CREATE OR REPLACE FUNCTION public.on_mood_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_name TEXT;
  emoji TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.mood_value = NEW.mood_value THEN
    RETURN NEW;
  END IF;
  SELECT display_name INTO user_name FROM public.profiles WHERE id = NEW.user_id;
  emoji := CASE WHEN NEW.mood_value >= 75 THEN '🥰' WHEN NEW.mood_value >= 50 THEN '🙂' WHEN NEW.mood_value >= 25 THEN '😕' ELSE '😢' END;
  PERFORM public.notify_push(
    'mood',
    NEW.user_id,
    COALESCE(user_name, 'Tu osit@') || ' se siente ' || emoji,
    'Ánimo: ' || NEW.mood_value || '%',
    '/moods'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER moods_push_trigger
  AFTER INSERT OR UPDATE ON public.moods
  FOR EACH ROW EXECUTE FUNCTION public.on_mood_change();
