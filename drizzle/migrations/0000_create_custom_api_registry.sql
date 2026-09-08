CREATE TABLE public.custom_apis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  description text,
  base_url text NOT NULL,
  path text NOT NULL DEFAULT '',
  method text NOT NULL DEFAULT 'GET',
  headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  query_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  body_template text,
  auth_type text NOT NULL DEFAULT 'none',
  auth_value text,
  timeout_ms integer NOT NULL DEFAULT 10000,
  enabled boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100,
  tags text[] NOT NULL DEFAULT '{}',
  last_status text,
  last_latency_ms integer,
  last_checked_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.custom_api_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id uuid NOT NULL REFERENCES public.custom_apis(id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.custom_api_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id uuid,
  api_slug text,
  action text NOT NULL,
  ok boolean,
  status_code integer,
  latency_ms integer,
  message text,
  actor text NOT NULL DEFAULT 'panel',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX custom_apis_enabled_idx ON public.custom_apis (enabled, priority);
CREATE INDEX custom_api_versions_api_idx ON public.custom_api_versions (api_id, created_at DESC);
CREATE INDEX custom_api_logs_created_idx ON public.custom_api_logs (created_at DESC);

REVOKE ALL ON public.custom_apis FROM anon, authenticated;
REVOKE ALL ON public.custom_api_versions FROM anon, authenticated;
REVOKE ALL ON public.custom_api_logs FROM anon, authenticated;
GRANT ALL ON public.custom_apis TO service_role;
GRANT ALL ON public.custom_api_versions TO service_role;
GRANT ALL ON public.custom_api_logs TO service_role;

ALTER TABLE public.custom_apis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_api_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_api_logs ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER custom_apis_touch BEFORE UPDATE ON public.custom_apis
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();