import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { writeAudit } from "./audit.functions";

/** Assert the caller is an admin. Throws otherwise. */
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

/** Check whether the signed-in user is an admin. Used by the admin gate. */
export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { isAdmin: !!data, userId: context.userId };
  });

/* ---------------- Site settings ---------------- */

const SettingsSchema = z.object({
  site_title: z.string().min(1).max(120),
  site_description: z.string().min(1).max(400),
  logo_url: z.string().url().max(1000).nullable().optional(),
  favicon_url: z.string().url().max(1000).nullable().optional(),
  accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  background_image: z.string().url().max(1000),
  background_overlay: z.number().min(0).max(1),
  background_blur: z.number().int().min(0).max(40),
  animations_enabled: z.boolean(),
  homepage_sections: z.array(
    z.object({
      key: z.string().min(1).max(40),
      label: z.string().min(1).max(60),
      enabled: z.boolean(),
    }),
  ).max(30),
  feature_flags: z.record(z.string(), z.boolean()).default({}),
});

export const saveSiteSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SettingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("site_settings")
      .update(data)
      .eq("id", 1);
    if (error) throw new Error(error.message);
    await writeAudit(context, { action: "update", area: "site_settings", details: { site_title: data.site_title } });
    return { ok: true };
  });

/* ---------------- API providers ---------------- */

const ProviderSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
  base_url: z.string().url().max(500),
  enabled: z.boolean(),
  priority: z.number().int().min(0).max(10000),
  notes: z.string().max(500).nullable().optional(),
});

export const saveProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ProviderSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.id) {
      const { error } = await context.supabase
        .from("api_providers")
        .update({
          name: data.name,
          base_url: data.base_url,
          enabled: data.enabled,
          priority: data.priority,
          notes: data.notes ?? null,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("api_providers").insert({
        name: data.name,
        base_url: data.base_url,
        enabled: data.enabled,
        priority: data.priority,
        notes: data.notes ?? null,
      });
      if (error) throw new Error(error.message);
    }
    await writeAudit(context, {
      action: data.id ? "update" : "create",
      area: "api_provider",
      target_id: data.id ?? data.name,
      details: { name: data.name, enabled: data.enabled },
    });
    return { ok: true };
  });

export const deleteProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("api_providers")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit(context, { action: "delete", area: "api_provider", target_id: data.id });
    return { ok: true };
  });

/** Ping a provider's base_url and record last_status/last_checked_at. */
export const checkProviderHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: prov, error } = await context.supabase
      .from("api_providers").select("*").eq("id", data.id).single();
    if (error || !prov) throw new Error(error?.message ?? "Provider not found");
    let status = "unknown";
    const started = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(prov.base_url, { method: "GET", signal: controller.signal });
      clearTimeout(timer);
      const ms = Date.now() - started;
      status = res.ok ? `ok ${res.status} · ${ms}ms` : `http ${res.status} · ${ms}ms`;
    } catch (e: any) {
      status = `error: ${String(e?.message ?? e).slice(0, 120)}`;
    }
    const updateRes = await context.supabase
      .from("api_providers")
      .update({ last_status: status, last_checked_at: new Date().toISOString() })
      .eq("id", data.id);
    if (updateRes.error) throw new Error(updateRes.error.message);
    return { status };
  });

/* ---------------- SEO overrides ---------------- */

const SeoSchema = z.object({
  id: z.string().uuid().optional(),
  route: z.string().trim().min(1).max(200).regex(/^\//, "Route must start with /"),
  title: z.string().max(160).nullable().optional(),
  description: z.string().max(400).nullable().optional(),
  og_image: z.string().url().max(1000).nullable().optional(),
  keywords: z.string().max(400).nullable().optional(),
});

export const saveSeo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SeoSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const payload = {
      route: data.route,
      title: data.title ?? null,
      description: data.description ?? null,
      og_image: data.og_image ?? null,
      keywords: data.keywords ?? null,
    };
    const { error } = await context.supabase
      .from("seo_overrides")
      .upsert(payload, { onConflict: "route" });
    if (error) throw new Error(error.message);
    await writeAudit(context, { action: "upsert", area: "seo_override", target_id: data.route });
    return { ok: true };
  });

export const deleteSeo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("seo_overrides").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit(context, { action: "delete", area: "seo_override", target_id: data.id });
    return { ok: true };
  });

/* ---------------- Roles / users ---------------- */

export const listAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("user_roles").select("*").eq("role", "admin");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const grantAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ user_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("user_roles")
      .insert({ user_id: data.user_id, role: "admin" });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    await writeAudit(context, { action: "grant_admin", area: "user_roles", target_id: data.user_id });
    return { ok: true };
  });

export const revokeAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ user_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.user_id === context.userId) {
      throw new Error("You cannot revoke your own admin role");
    }
    const { error } = await context.supabase
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .eq("role", "admin");
    if (error) throw new Error(error.message);
    await writeAudit(context, { action: "revoke_admin", area: "user_roles", target_id: data.user_id });
    return { ok: true };
  });

/* ---------------- Dashboard stats ---------------- */

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const [libRes, profRes, provRes, seoRes, admRes] = await Promise.all([
      context.supabase.from("library_entries").select("id", { count: "exact", head: true }),
      context.supabase.from("profiles").select("id", { count: "exact", head: true }),
      context.supabase.from("api_providers").select("id, enabled"),
      context.supabase.from("seo_overrides").select("id", { count: "exact", head: true }),
      context.supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin"),
    ]);
    const providers = provRes.data ?? [];
    return {
      libraryEntries: libRes.count ?? 0,
      profiles: profRes.count ?? 0,
      providersTotal: providers.length,
      providersEnabled: providers.filter((p: any) => p.enabled).length,
      seoOverrides: seoRes.count ?? 0,
      admins: admRes.count ?? 0,
    };
  });

/* ---------------- Users by email ---------------- */

export const listAllUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 500 });
    if (error) throw new Error(error.message);
    const { data: roles } = await (supabaseAdmin as any).from("user_roles").select("user_id, role");
    const { data: profiles } = await (supabaseAdmin as any).from("profiles").select("id, display_name");
    return data.users.map(u => ({
      id: u.id,
      email: u.email ?? "",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      display_name: (profiles ?? []).find((p: any) => p.id === u.id)?.display_name ?? null,
      roles: (roles ?? []).filter((r: any) => r.user_id === u.id).map((r: any) => r.role as string),
    }));
  });

const RoleEnum = z.enum(["admin", "moderator", "user"]);

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      email: z.string().trim().email().max(255),
      role: RoleEnum,
      grant: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw new Error(error.message);
    const user = list.users.find(u => (u.email ?? "").toLowerCase() === data.email.toLowerCase());
    if (!user) throw new Error("No account with that email. They must sign up first.");
    if (!data.grant && data.role === "admin" && user.id === context.userId) {
      throw new Error("You cannot revoke your own admin role");
    }
    const db = supabaseAdmin as any;
    const { error: e2 } = data.grant
      ? await db.from("user_roles").upsert({ user_id: user.id, role: data.role }, { onConflict: "user_id,role", ignoreDuplicates: true })
      : await db.from("user_roles").delete().eq("user_id", user.id).eq("role", data.role);
    if (e2) throw new Error(e2.message);
    await writeAudit(context, { action: data.grant ? "grant_role" : "revoke_role", area: "user_roles", target_id: user.id, details: { role: data.role, email: data.email } });
    return { ok: true };
  });

/* ---------------- Custom APIs (panel-added) ---------------- */

export const listCustomApisAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("custom_apis")
      .select("id, slug, name, category, description, base_url, path, method, enabled, priority, tags, last_status, last_latency_ms, last_checked_at")
      .is("deleted_at", null)
      .order("priority", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as any[];
  });

export const toggleCustomApiAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("custom_apis").update({ enabled: data.enabled }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit(context, { action: data.enabled ? "enable" : "disable", area: "custom_api", target_id: data.id });
    return { ok: true };
  });

export const softDeleteCustomApiAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("custom_apis").update({ deleted_at: new Date().toISOString(), enabled: false }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit(context, { action: "soft_delete", area: "custom_api", target_id: data.id });
    return { ok: true };
  });
