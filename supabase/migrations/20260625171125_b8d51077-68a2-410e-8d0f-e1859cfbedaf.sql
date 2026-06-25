
DROP POLICY "auth update events" ON public.calendar_events;
DROP POLICY "auth delete events" ON public.calendar_events;
CREATE POLICY "creator update events" ON public.calendar_events FOR UPDATE TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
CREATE POLICY "creator delete events" ON public.calendar_events FOR DELETE TO authenticated USING (auth.uid() = created_by);

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Storage policies for chat-media bucket
CREATE POLICY "auth read chat media" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'chat-media');
CREATE POLICY "auth upload chat media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chat-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "auth delete own chat media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'chat-media' AND auth.uid()::text = (storage.foldername(name))[1]);
