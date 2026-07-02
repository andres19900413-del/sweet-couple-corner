CREATE POLICY "auth update message reactions"
ON public.messages
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);