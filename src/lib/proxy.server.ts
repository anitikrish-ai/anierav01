/**
 * Server-only egress helper.
 *
 * Users may pick a proxy relay from an admin-managed allowlist. They can never
 * supply a raw proxy address, so there is nothing to spoof: the server only
 * ever talks to relays an administrator has stored in `proxy_endpoints`.
 * Outbound targets are validated (https only, no private/loopback hosts) to
 * prevent SSRF. The caller's real IP is recorded in `proxy_request_logs` for
 * admin-side security review, while the external provider only sees the relay.
 */

const PRIVATE_HOST = /^(localhost|127\.|0\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?|metadata\.google\.internal)/i;

export type ProxyRow = {
  id: string;
  label: string;
  url: string;
  enabled: boolean;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/** Reject anything that is not a public https endpoint. */
export function assertSafeTarget(target: string): URL {
  let u: URL;
  try {
    u = new URL(target);
  } catch {
    throw new Error("Invalid target URL");
  }
  if (u.protocol !== "https:") throw new Error("Only https targets are allowed");
  if (PRIVATE_HOST.test(u.hostname)) throw new Error("Target host is not allowed");
  return u;
}

/** Look up an allowlisted, enabled proxy. Returns null when none applies. */
export async function resolveProxy(proxyId?: string | null): Promise<ProxyRow | null> {
  if (!proxyId) return null;
  if (!/^[0-9a-f-]{36}$/i.test(proxyId)) return null;
  const db = await admin();
  const { data } = await db
    .from("proxy_endpoints")
    .select("id, label, url, enabled")
    .eq("id", proxyId)
    .eq("enabled", true)
    .maybeSingle();
  return (data as ProxyRow) ?? null;
}

export function buildProxiedUrl(proxyUrl: string, target: string): string {
  if (/[?&][a-z_]+=$/i.test(proxyUrl)) return proxyUrl + encodeURIComponent(target);
  if (proxyUrl.endsWith("/")) return proxyUrl + target;
  return proxyUrl.replace(/\/$/, "") + "/" + target;
}

export function clientIpFrom(headers: Headers): string | null {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim().slice(0, 60);
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    null
  );
}

/**
 * Fetch `target`, optionally relayed through an allowlisted proxy.
 * Always logs the attempt server-side (real client IP included).
 */
export async function proxiedFetch(opts: {
  target: string;
  proxyId?: string | null;
  init?: RequestInit;
  timeoutMs?: number;
  clientIp?: string | null;
  userId?: string | null;
}): Promise<{ ok: boolean; status: number; body: string; viaProxy: string | null }> {
  const url = assertSafeTarget(opts.target);
  const proxy = await resolveProxy(opts.proxyId);
  const finalUrl = proxy ? buildProxiedUrl(proxy.url, url.toString()) : url.toString();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 12000);
  const started = Date.now();
  let ok = false;
  let status = 0;
  let body = "";
  let message: string | null = null;
  try {
    const res = await fetch(finalUrl, { ...opts.init, signal: controller.signal });
    ok = res.ok;
    status = res.status;
    body = (await res.text()).slice(0, 200000);
  } catch (e: any) {
    message = String(e?.message ?? e).slice(0, 300);
    body = message;
  } finally {
    clearTimeout(timer);
  }

  try {
    const db = await admin();
    await db.from("proxy_request_logs").insert({
      user_id: opts.userId ?? null,
      client_ip: opts.clientIp ?? null,
      proxy_id: proxy?.id ?? null,
      proxy_label: proxy?.label ?? null,
      target_host: url.hostname,
      ok,
      status_code: status || null,
      latency_ms: Date.now() - started,
      message,
    });
  } catch {
    /* logging must never break the request */
  }

  return { ok, status, body, viaProxy: proxy?.label ?? null };
}

/** Health check a relay by fetching a known-good target through it. */
export async function probeProxy(proxyUrl: string): Promise<string> {
  const started = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(buildProxiedUrl(proxyUrl, "https://api.jikan.moe/v4/genres/anime"), {
      signal: controller.signal,
    });
    clearTimeout(timer);
    const ms = Date.now() - started;
    return res.ok ? `ok ${res.status} · ${ms}ms` : `http ${res.status} · ${ms}ms`;
  } catch (e: any) {
    return `error: ${String(e?.message ?? e).slice(0, 120)}`;
  }
}
