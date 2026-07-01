
DROP POLICY IF EXISTS "Authenticated can update thoughts" ON public.thoughts;
CREATE POLICY "Receiver can mark thoughts seen" ON public.thoughts
  FOR UPDATE TO authenticated
  USING (auth.uid() <> sender_id)
  WITH CHECK (auth.uid() <> sender_id AND seen = true);
