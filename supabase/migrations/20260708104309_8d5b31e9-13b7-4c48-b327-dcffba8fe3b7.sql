
-- 1. Restrict letters UPDATE: only authors can update fully; others (recipients) may only toggle opened_at once after unlock.
DROP POLICY IF EXISTS "recipients can mark opened" ON public.letters;

CREATE POLICY "recipients can mark opened"
ON public.letters
FOR UPDATE
TO authenticated
USING (unlock_at <= now() AND auth.uid() <> author_id)
WITH CHECK (unlock_at <= now() AND auth.uid() <> author_id);

CREATE OR REPLACE FUNCTION public.protect_letter_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() <> OLD.author_id THEN
    IF NEW.author_id IS DISTINCT FROM OLD.author_id
       OR NEW.title IS DISTINCT FROM OLD.title
       OR NEW.content IS DISTINCT FROM OLD.content
       OR NEW.unlock_at IS DISTINCT FROM OLD.unlock_at
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Only the author can modify letter contents; recipients can only mark it opened';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_letter_fields_trg ON public.letters;
CREATE TRIGGER protect_letter_fields_trg
BEFORE UPDATE ON public.letters
FOR EACH ROW EXECUTE FUNCTION public.protect_letter_fields();

-- 2. Scope profiles bucket SELECT to owner's folder only.
DROP POLICY IF EXISTS "Auth can view profile media" ON storage.objects;

CREATE POLICY "Users read own profile media"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'profiles'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);
