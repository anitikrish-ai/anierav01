CREATE TABLE public.anime_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mal_id integer NOT NULL,
  anime_title text NOT NULL,
  rating smallint CHECK (rating BETWEEN 1 AND 10),
  body text NOT NULL,
  spoiler boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, mal_id)
);

CREATE INDEX anime_reviews_mal_id_idx ON public.anime_reviews (mal_id, created_at DESC);

GRANT SELECT ON public.anime_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.anime_reviews TO authenticated;
GRANT ALL ON public.anime_reviews TO service_role;

ALTER TABLE public.anime_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read reviews" ON public.anime_reviews
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "own review insert" ON public.anime_reviews
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own review update" ON public.anime_reviews
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own review delete" ON public.anime_reviews
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "admins delete reviews" ON public.anime_reviews
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER anime_reviews_touch BEFORE UPDATE ON public.anime_reviews
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- reviews show author display name/avatar; profiles read is owner-only today
CREATE POLICY "public read profile basics" ON public.profiles
  FOR SELECT TO anon, authenticated USING (true);

GRANT SELECT ON public.profiles TO anon;