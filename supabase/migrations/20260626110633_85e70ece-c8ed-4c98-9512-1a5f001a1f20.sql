
CREATE TABLE public.photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id uuid NOT NULL,
  storage_path text NOT NULL,
  caption text,
  taken_on date,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.photos TO authenticated;
GRANT ALL ON public.photos TO service_role;

ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read photos" ON public.photos FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert own photos" ON public.photos FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploader_id);
CREATE POLICY "uploader update photos" ON public.photos FOR UPDATE TO authenticated USING (auth.uid() = uploader_id) WITH CHECK (auth.uid() = uploader_id);
CREATE POLICY "uploader delete photos" ON public.photos FOR DELETE TO authenticated USING (auth.uid() = uploader_id);

-- Storage policies for gallery bucket
CREATE POLICY "auth read gallery" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'gallery');
CREATE POLICY "auth upload gallery" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'gallery' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "auth delete own gallery" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'gallery' AND auth.uid()::text = (storage.foldername(name))[1]);
