DROP POLICY IF EXISTS "public read profile basics" ON public.profiles;
REVOKE SELECT ON public.profiles FROM anon;

ALTER TABLE public.anime_reviews
  ADD COLUMN author_name text NOT NULL DEFAULT 'Anonymous',
  ADD COLUMN author_avatar text;