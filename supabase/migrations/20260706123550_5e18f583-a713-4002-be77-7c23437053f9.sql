
CREATE POLICY "Auth can view profile media" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'profiles');
CREATE POLICY "Users upload own profile media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'profiles' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users update own profile media" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'profiles' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own profile media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'profiles' AND (storage.foldername(name))[1] = auth.uid()::text);
