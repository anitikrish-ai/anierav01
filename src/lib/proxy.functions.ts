import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ------------------------------------------------------------------ */
/* Public: list selectable relays                                      */
/* ------------------------------------------------------------------ */

export type PublicProxy = {
  id: string;
  label: string;
  display_ip: string | null;
  region: string | null;
};

export const listProxyEndpoints = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicProxy[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("proxy_endpoints")
      .select("id, label, display_ip, region")
      .eq("enabled", true)
      .order("priority", { ascending: true });
    return (data ?? []) as PublicProxy[];
  },
);

/* ------------------------------------------------------------------ */
/* Signed-in preference                                                */
/* ------------------------------------------------------------------ */

export const getProxyPreference = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles")
      .select("proxy_endpoint_id")
      .eq("id", context.userId)
      .maybeSingle();
    return { proxyId: (data as any)?.proxy_endpoint_id ?? null };
  });

export const setProxyPreference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ proxyId: z.string().uuid().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.proxyId) {
      // only an admin-allowlisted, enabled relay may be selected
      const { data: row } = await context.supabase
        .from("proxy_endpoints")
        .select("id")
        .eq("id", data.proxyId)
        .eq("enabled", true)
        .maybeSingle();
      if (!row) throw new Error("That proxy is not available");
    }
    const { error } = await context.supabase
      .from("profiles")
      .update({ proxy_endpoint_id: data.proxyId })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true, proxyId: data.proxyId };
  });

/* ------------------------------------------------------------------ */
/* Admin management                                                    */
/* ------------------------------------------------------------------ */

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

export const listProxiesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("proxy_endpoints")
      .select("*")
      .order("priority", { ascending: true });
    return (data ?? []) as any[];
  });

const ProxySchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1).max(80),
  url: z.string().url().max(500).refine(u => u.startsWith("https://"), "Must be https"),
  display_ip: z.string().max(80).nullable().optional(),
  region: z.string().max(80).nullable().optional(),
  enabled: z.boolean(),
  priority: z.number().int().min(0).max(10000),
  notes: z.string().max(500).nullable().optional(),
});

export const saveProxyEndpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ProxySchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      label: data.label,
      url: data.url,
      display_ip: data.display_ip ?? null,
      region: data.region ?? null,
      enabled: data.enabled,
      priority: data.priority,
      notes: data.notes ?? null,
    };
    const db = supabaseAdmin as any;
    const { error } = data.id
      ? await db.from("proxy_endpoints").update(payload).eq("id", data.id)
      : await db.from("proxy_endpoints").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProxyEndpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    await db.from("profiles").update({ proxy_endpoint_id: null }).eq("proxy_endpoint_id", data.id);
    const { error } = await db.from("proxy_endpoints").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const checkProxyEndpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { probeProxy } = await import("./proxy.server");
    const db = supabaseAdmin as any;
    const { data: row } = await db.from("proxy_endpoints").select("url").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Proxy not found");
    const status = await probeProxy(row.url);
    await db
      .from("proxy_endpoints")
      .update({ last_status: status, last_checked_at: new Date().toISOString() })
      .eq("id", data.id);
    return { status };
  });

export const listProxyLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("proxy_request_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/* ------------------------------------------------------------------ */
/* Verification: what the outside world sees                           */
/* ------------------------------------------------------------------ */

export const verifyProxy = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ proxyId: z.string().uuid().nullable() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { proxiedFetch, clientIpFrom } = await import("./proxy.server");
    const clientIp = clientIpFrom(getRequest().headers);
    const r = await proxiedFetch({
      target: "https://api.ipify.org?format=json",
      proxyId: data.proxyId,
      clientIp,
      timeoutMs: 10000,
    });
    let seenIp: string | null = null;
    try {
      seenIp = JSON.parse(r.body)?.ip ?? null;
    } catch {
      const m = r.body.match(/\d+\.\d+\.\d+\.\d+/);
      seenIp = m ? m[0] : null;
    }
    return { ok: r.ok, seenIp, viaProxy: r.viaProxy };
  });
