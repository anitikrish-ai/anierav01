CREATE TABLE public.proxy_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  url text NOT NULL,
  display_ip text,
  region text,
  enabled boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100,
  notes text,
  last_status text,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.proxy_endpoints TO anon;
GRANT SELECT ON public.proxy_endpoints TO authenticated;
GRANT ALL ON public.proxy_endpoints TO service_role;

ALTER TABLE public.proxy_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read enabled proxies" ON public.proxy_endpoints
  FOR SELECT TO anon, authenticated USING (enabled = true);

CREATE POLICY "admins manage proxies" ON public.proxy_endpoints
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_proxy_endpoints_updated
  BEFORE UPDATE ON public.proxy_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS proxy_endpoint_id uuid;

CREATE TABLE public.proxy_request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  client_ip text,
  proxy_id uuid,
  proxy_label text,
  target_host text,
  ok boolean,
  status_code integer,
  latency_ms integer,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proxy_request_logs_created ON public.proxy_request_logs (created_at DESC);

GRANT SELECT ON public.proxy_request_logs TO authenticated;
GRANT ALL ON public.proxy_request_logs TO service_role;

ALTER TABLE public.proxy_request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read proxy logs" ON public.proxy_request_logs
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));
