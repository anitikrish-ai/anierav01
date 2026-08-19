import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Assert the caller is an admin. Throws otherwise. */
async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

/** Write an audit entry. Safe to call from other admin server functions. */
export async function writeAudit(
  context: { supabase: any; userId: string; claims?: any },
  entry: { action: string; area: string; target_id?: string | null; details?: unknown },
) {
  await context.supabase.from("audit_log").insert({
    actor_id: context.userId,
    actor_email: context.claims?.email ?? null,
    action: entry.action,
    area: entry.area,
    target_id: entry.target_id ?? null,
    details: (entry.details ?? {}) as any,
  });
}

export const listAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const logAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        action: z.string().min(1).max(80),
        area: z.string().min(1).max(60),
        target_id: z.string().max(200).nullable().optional(),
        details: z.record(z.string(), z.any()).default({}),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    await writeAudit(context, data);
    return { ok: true };
  });

export const clearAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ olderThanDays: z.number().int().min(0).max(3650).default(0) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const cutoff = new Date(Date.now() - data.olderThanDays * 86400_000).toISOString();
    const { error } = await context.supabase
      .from("audit_log")
      .delete()
      .lt("created_at", cutoff);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
