
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;

CREATE POLICY "admins read roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Site settings (singleton row, id = 1)
CREATE TABLE public.site_settings (
  id smallint PRIMARY KEY DEFAULT 1,
  site_title text NOT NULL DEFAULT 'AniEra',
  site_description text NOT NULL DEFAULT 'Premium anime streaming hub',
  logo_url text,
  favicon_url text,
  accent_color text NOT NULL DEFAULT '#8b5cf6',
  background_image text NOT NULL DEFAULT 'https://i.pinimg.com/736x/70/a9/09/70a909322b27f1001d5ace42d1821ff0.jpg',
  background_overlay numeric NOT NULL DEFAULT 0.7,
  background_blur integer NOT NULL DEFAULT 0,
  homepage_sections jsonb NOT NULL DEFAULT
    '[{"key":"hero","label":"Hero","enabled":true},{"key":"trending","label":"Trending","enabled":true},{"key":"popular","label":"Popular","enabled":true},{"key":"latest","label":"Latest","enabled":true},{"key":"movies","label":"Movies","enabled":true},{"key":"schedule","label":"Schedule","enabled":true}]'::jsonb,
  animations_enabled boolean NOT NULL DEFAULT true,
  feature_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_settings_singleton CHECK (id = 1)
);
INSERT INTO public.site_settings (id) VALUES (1);
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read site settings" ON public.site_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins update site settings" ON public.site_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins insert site settings" ON public.site_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- API providers
CREATE TABLE public.api_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  base_url text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100,
  notes text,
  last_status text,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.api_providers TO anon, authenticated;
GRANT ALL ON public.api_providers TO service_role;
ALTER TABLE public.api_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read providers" ON public.api_providers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins manage providers" ON public.api_providers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.api_providers (name, base_url, enabled, priority, notes) VALUES
  ('Jikan', 'https://api.jikan.moe/v4', true, 10, 'MyAnimeList metadata (default)'),
  ('AniList', 'https://graphql.anilist.co', true, 20, 'AniList GraphQL metadata'),
  ('HiAnime', 'https://hianime.to', true, 30, 'Streaming source proxy');

-- SEO overrides
CREATE TABLE public.seo_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route text NOT NULL UNIQUE,
  title text,
  description text,
  og_image text,
  keywords text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.seo_overrides TO anon, authenticated;
GRANT ALL ON public.seo_overrides TO service_role;
ALTER TABLE public.seo_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read seo" ON public.seo_overrides FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins manage seo" ON public.seo_overrides FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- updated_at triggers (reuse existing touch_updated_at)
CREATE TRIGGER trg_site_settings_updated BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_api_providers_updated BEFORE UPDATE ON public.api_providers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_seo_overrides_updated BEFORE UPDATE ON public.seo_overrides
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
