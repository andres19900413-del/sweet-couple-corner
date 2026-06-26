
ALTER TABLE public.photos
  ADD COLUMN IF NOT EXISTS tagged_names text[] NOT NULL DEFAULT '{}';
