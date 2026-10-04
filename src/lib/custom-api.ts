import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Integration layer: exposes ONLY the APIs added through the private panel
 * to the main app. Secrets (auth_value, raw headers) never leave the server.
 */

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export type PublicCustomApi = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string | null;
  method: string;
  tags: string[];
  priority: number;
  last_status: string | null;
};

export const listEnabledCustomApis = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicCustomApi[]> => {
    const db = await admin();
    const { data, error } = await db
      .from("custom_apis")
      .select("id, slug, name, category, description, method, tags, priority, last_status")
      .eq("enabled", true)
      .is("deleted_at", null)
      .order("priority", { ascending: true });
    if (error) return [];
    return (data ?? []) as PublicCustomApi[];
  },
);

/** Invoke an enabled custom API by slug. Credentials stay server-side. */
export const callCustomApi = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        slug: z.string().min(1).max(60),
        query: z.string().max(500).default(""),
        proxyId: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: a, error } = await db
      .from("custom_apis")
      .select("*")
      .eq("slug", data.slug)
      .eq("enabled", true)
      .is("deleted_at", null)
      .maybeSingle();
    if (error || !a) return { ok: false as const, status: 404, body: "API not found or disabled", viaProxy: null };

    const started = Date.now();
    try {
      const url = new URL(String(a.base_url).replace(/\/$/, "") + (a.path ?? ""));
      for (const [k, v] of Object.entries((a.query_params ?? {}) as Record<string, string>)) {
        url.searchParams.set(k, String(v).replace("{query}", data.query));
      }
      const headers: Record<string, string> = { ...((a.headers ?? {}) as Record<string, string>) };
      if (a.auth_type === "bearer" && a.auth_value) headers["Authorization"] = `Bearer ${a.auth_value}`;
      if (a.auth_type === "api_key_header" && a.auth_value) headers["X-API-Key"] = a.auth_value;
      if (a.auth_type === "query_key" && a.auth_value) url.searchParams.set("api_key", a.auth_value);

      const method = String(a.method ?? "GET").toUpperCase();
      const body =
        method !== "GET" && a.body_template
          ? String(a.body_template).replace("{query}", data.query)
          : undefined;
      const { proxiedFetch, clientIpFrom } = await import("./proxy.server");
      const { getRequest } = await import("@tanstack/react-start/server");
      let clientIp: string | null = null;
      try { clientIp = clientIpFrom(getRequest().headers); } catch { /* no request */ }
      const r = await proxiedFetch({
        target: url.toString(),
        // relays only support simple GET passthrough
        proxyId: method === "GET" ? data.proxyId ?? null : null,
        init: { method, headers, body },
        timeoutMs: a.timeout_ms ?? 10000,
        clientIp,
      });
      if (r.status === 0) throw new Error(r.body);
      const res = { ok: r.ok, status: r.status };
      const latency = Date.now() - started;
      const text = r.body.slice(0, 100000);
      await db.from("custom_api_logs").insert({
        api_id: a.id,
        api_slug: a.slug,
        action: "call",
        ok: res.ok,
        status_code: res.status,
        latency_ms: latency,
        actor: "app",
      });
      return { ok: res.ok, status: res.status, body: text, viaProxy: r.viaProxy };
    } catch (e: any) {
      const message = String(e?.message ?? e).slice(0, 300);
      await db.from("custom_api_logs").insert({
        api_id: a.id,
        api_slug: a.slug,
        action: "call",
        ok: false,
        message,
        actor: "app",
      });
      return { ok: false as const, status: 0, body: message, viaProxy: null };
    }
  });
