import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { writeAudit } from "./audit.functions";

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

/** Export site configuration (settings, providers, SEO overrides) as JSON. */
export const exportBackup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const [settings, providers, seo] = await Promise.all([
      context.supabase.from("site_settings").select("*").eq("id", 1).maybeSingle(),
      context.supabase.from("api_providers").select("*").order("priority"),
      context.supabase.from("seo_overrides").select("*").order("route"),
    ]);
    if (settings.error) throw new Error(settings.error.message);
    if (providers.error) throw new Error(providers.error.message);
    if (seo.error) throw new Error(seo.error.message);
    await writeAudit(context, { action: "export", area: "backup" });
    return {
      version: 1,
      exported_at: new Date().toISOString(),
      site_settings: settings.data ?? null,
      api_providers: providers.data ?? [],
      seo_overrides: seo.data ?? [],
    };
  });

const BackupSchema = z.object({
  version: z.number().optional(),
  site_settings: z.record(z.string(), z.any()).nullable().optional(),
  api_providers: z.array(z.record(z.string(), z.any())).default([]),
  seo_overrides: z.array(z.record(z.string(), z.any())).default([]),
});

const SETTINGS_FIELDS = [
  "site_title", "site_description", "logo_url", "favicon_url", "accent_color",
  "background_image", "background_overlay", "background_blur",
  "homepage_sections", "animations_enabled", "feature_flags",
] as const;

const PROVIDER_FIELDS = ["name", "base_url", "enabled", "priority", "notes"] as const;
const SEO_FIELDS = ["route", "title", "description", "og_image", "keywords"] as const;

function pick(row: Record<string, any>, fields: readonly string[]) {
  const out: Record<string, any> = {};
  for (const f of fields) if (row[f] !== undefined) out[f] = row[f];
  return out;
}

/** Restore configuration from a previously exported backup. Replaces providers + SEO. */
export const restoreBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BackupSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    if (data.site_settings) {
      const payload = pick(data.site_settings, SETTINGS_FIELDS);
      if (Object.keys(payload).length) {
        const { error } = await context.supabase
          .from("site_settings").update(payload as any).eq("id", 1);
        if (error) throw new Error(error.message);
      }
    }

    let providers = 0;
    if (data.api_providers.length) {
      const del = await context.supabase
        .from("api_providers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (del.error) throw new Error(del.error.message);
      const rows = data.api_providers.map(p => pick(p, PROVIDER_FIELDS));
      const { error } = await context.supabase.from("api_providers").insert(rows as any);
      if (error) throw new Error(error.message);
      providers = rows.length;
    }

    let seo = 0;
    if (data.seo_overrides.length) {
      const rows = data.seo_overrides.map(s => pick(s, SEO_FIELDS)).filter(r => r.route);
      const { error } = await context.supabase
        .from("seo_overrides").upsert(rows as any, { onConflict: "route" });
      if (error) throw new Error(error.message);
      seo = rows.length;
    }

    await writeAudit(context, {
      action: "restore",
      area: "backup",
      details: { providers, seo, settings: !!data.site_settings },
    });
    return { ok: true, providers, seo };
  });
