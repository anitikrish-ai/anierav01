import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Private API Management panel — server functions.
 *
 * Security model:
 *  - Shared-password gate stored in an encrypted, httpOnly session cookie.
 *  - Every mutating action ALSO requires the password again (confirmation).
 *  - All database access happens with the service role INSIDE handlers, after
 *    the gate has been verified. The tables have no anon/authenticated grants.
 *  - Only APIs created through this panel live in `custom_apis`; the app's
 *    built-in providers are untouched.
 */

type PanelSession = { unlocked?: boolean; at?: number };

function sessionConfig() {
  const password = process.env["API_PANEL_SESSION_SECRET"];
  if (!password) throw new Error("API panel session secret is not configured");
  return {
    password,
    name: "api-panel",
    maxAge: 60 * 60 * 2, // 2 hours
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      path: "/",
    },
  };
}

function passwordMatches(input: string): boolean {
  const expected = process.env["API_PANEL_PASSWORD"];
  if (!expected) throw new Error("API panel password is not configured");
  const a = createHash("sha256").update(String(input), "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

async function requireUnlocked() {
  const session = await useSession<PanelSession>(sessionConfig());
  if (!session.data.unlocked) throw new Error("Locked: sign in to the panel");
  return session;
}

/** Gate + password re-confirmation for every write action. */
async function requireConfirmed(confirmPassword: string) {
  await requireUnlocked();
  if (!passwordMatches(confirmPassword)) {
    throw new Error("Password confirmation failed");
  }
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function log(entry: {
  api_id?: string | null;
  api_slug?: string | null;
  action: string;
  ok?: boolean | null;
  status_code?: number | null;
  latency_ms?: number | null;
  message?: string | null;
}) {
  try {
    const db = await admin();
    await db.from("custom_api_logs").insert({ ...entry, actor: "panel" });
  } catch {
    /* logging must never break an action */
  }
}

/* ------------------------------ session ------------------------------ */

export const panelStatus = createServerFn({ method: "GET" }).handler(async () => {
  const session = await useSession<PanelSession>(sessionConfig());
  return { unlocked: !!session.data.unlocked };
});

export const unlockPanel = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ password: z.string().min(1).max(300) }).parse(d))
  .handler(async ({ data }) => {
    if (!passwordMatches(data.password)) {
      await log({ action: "unlock_failed", ok: false, message: "bad password" });
      return { ok: false as const };
    }
    const session = await useSession<PanelSession>(sessionConfig());
    await session.update({ unlocked: true, at: Date.now() });
    await log({ action: "unlock", ok: true });
    return { ok: true as const };
  });

export const lockPanel = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<PanelSession>(sessionConfig());
  await session.clear();
  return { ok: true as const };
});

/* ------------------------------- schema ------------------------------- */

const kvRecord = z.record(z.string().max(200), z.string().max(2000));

const ApiSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9][a-z0-9-_]*$/, "Use lowercase letters, numbers, - and _"),
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(60).default("general"),
  description: z.string().max(600).nullable().optional(),
  base_url: z.string().url().max(600),
  path: z.string().max(400).default(""),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
  headers: kvRecord.default({}),
  query_params: kvRecord.default({}),
  body_template: z.string().max(20000).nullable().optional(),
  auth_type: z.enum(["none", "bearer", "api_key_header", "query_key"]).default("none"),
  auth_value: z.string().max(1000).nullable().optional(),
  timeout_ms: z.number().int().min(1000).max(30000).default(10000),
  enabled: z.boolean().default(true),
  priority: z.number().int().min(0).max(10000).default(100),
  tags: z.array(z.string().max(40)).max(20).default([]),
});

export type CustomApiInput = z.infer<typeof ApiSchema>;

/* -------------------------------- read -------------------------------- */

export const listApis = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        search: z.string().max(200).optional(),
        category: z.string().max(60).optional(),
        status: z.enum(["all", "enabled", "disabled", "deleted"]).default("all"),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    await requireUnlocked();
    const db = await admin();
    let q = db.from("custom_apis").select("*").order("priority", { ascending: true });
    if (data.status === "deleted") q = q.not("deleted_at", "is", null);
    else q = q.is("deleted_at", null);
    if (data.status === "enabled") q = q.eq("enabled", true);
    if (data.status === "disabled") q = q.eq("enabled", false);
    if (data.category) q = q.eq("category", data.category);
    if (data.search) {
      const s = `%${data.search.replace(/[%_]/g, "")}%`;
      q = q.or(`name.ilike.${s},slug.ilike.${s},base_url.ilike.${s}`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listLogs = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ limit: z.number().int().min(1).max(300).default(100) }).parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    await requireUnlocked();
    const db = await admin();
    const { data: rows, error } = await db
      .from("custom_api_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listVersions = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ api_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const db = await admin();
    const { data: rows, error } = await db
      .from("custom_api_versions")
      .select("*")
      .eq("api_id", data.api_id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/* -------------------------------- write -------------------------------- */

async function snapshot(id: string, reason: string) {
  const db = await admin();
  const { data: row } = await db.from("custom_apis").select("*").eq("id", id).maybeSingle();
  if (row) await db.from("custom_api_versions").insert({ api_id: id, snapshot: row, reason });
}

export const saveApi = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ confirmPassword: z.string().min(1), api: ApiSchema }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireConfirmed(data.confirmPassword);
    const db = await admin();
    const a = data.api;
    const payload = {
      slug: a.slug,
      name: a.name,
      category: a.category,
      description: a.description ?? null,
      base_url: a.base_url,
      path: a.path,
      method: a.method,
      headers: a.headers,
      query_params: a.query_params,
      body_template: a.body_template ?? null,
      auth_type: a.auth_type,
      auth_value: a.auth_value ?? null,
      timeout_ms: a.timeout_ms,
      enabled: a.enabled,
      priority: a.priority,
      tags: a.tags,
    };
    if (a.id) {
      await snapshot(a.id, "before update");
      const { error } = await db.from("custom_apis").update(payload).eq("id", a.id);
      if (error) throw new Error(error.message);
      await log({ api_id: a.id, api_slug: a.slug, action: "update", ok: true });
      return { ok: true as const, id: a.id };
    }
    const { data: row, error } = await db.from("custom_apis").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    await log({ api_id: row.id, api_slug: a.slug, action: "create", ok: true });
    return { ok: true as const, id: row.id as string };
  });

export const setApiEnabled = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({ confirmPassword: z.string().min(1), id: z.string().uuid(), enabled: z.boolean() })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireConfirmed(data.confirmPassword);
    const db = await admin();
    await snapshot(data.id, "before toggle");
    const { error } = await db.from("custom_apis").update({ enabled: data.enabled }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await log({ api_id: data.id, action: data.enabled ? "enable" : "disable", ok: true });
    return { ok: true as const };
  });

export const deleteApi = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        confirmPassword: z.string().min(1),
        id: z.string().uuid(),
        permanent: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireConfirmed(data.confirmPassword);
    const db = await admin();
    await snapshot(data.id, data.permanent ? "before permanent delete" : "before delete");
    if (data.permanent) {
      const { error } = await db.from("custom_apis").delete().eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db
        .from("custom_apis")
        .update({ deleted_at: new Date().toISOString(), enabled: false })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    }
    await log({ api_id: data.id, action: data.permanent ? "purge" : "delete", ok: true });
    return { ok: true as const };
  });

export const restoreApi = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ confirmPassword: z.string().min(1), id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireConfirmed(data.confirmPassword);
    const db = await admin();
    const { error } = await db.from("custom_apis").update({ deleted_at: null }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await log({ api_id: data.id, action: "restore", ok: true });
    return { ok: true as const };
  });

export const rollbackApi = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ confirmPassword: z.string().min(1), version_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireConfirmed(data.confirmPassword);
    const db = await admin();
    const { data: v, error } = await db
      .from("custom_api_versions")
      .select("*")
      .eq("id", data.version_id)
      .single();
    if (error || !v) throw new Error(error?.message ?? "Version not found");
    const s = v.snapshot as Record<string, unknown>;
    const { id, created_at, updated_at, ...rest } = s as any;
    await snapshot(v.api_id, "before rollback");
    const { error: upErr } = await db.from("custom_apis").update(rest).eq("id", v.api_id);
    if (upErr) throw new Error(upErr.message);
    await log({ api_id: v.api_id, action: "rollback", ok: true, message: `to ${v.created_at}` });
    return { ok: true as const };
  });

/* -------------------------------- test -------------------------------- */

const TestSchema = z.object({
  api: ApiSchema.partial({ id: true }),
  sampleQuery: z.string().max(500).optional(),
});

export const testApi = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => TestSchema.parse(d))
  .handler(async ({ data }) => {
    await requireUnlocked();
    const a = data.api;
    const started = Date.now();
    try {
      const url = new URL((a.base_url ?? "").replace(/\/$/, "") + (a.path ?? ""));
      for (const [k, v] of Object.entries(a.query_params ?? {})) {
        url.searchParams.set(k, String(v).replace("{query}", data.sampleQuery ?? ""));
      }
      const headers: Record<string, string> = { ...(a.headers ?? {}) };
      if (a.auth_type === "bearer" && a.auth_value) headers["Authorization"] = `Bearer ${a.auth_value}`;
      if (a.auth_type === "api_key_header" && a.auth_value) headers["X-API-Key"] = a.auth_value;
      if (a.auth_type === "query_key" && a.auth_value) url.searchParams.set("api_key", a.auth_value);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), a.timeout_ms ?? 10000);
      const res = await fetch(url.toString(), {
        method: a.method ?? "GET",
        headers,
        body:
          a.method && a.method !== "GET" && a.body_template
            ? a.body_template.replace("{query}", data.sampleQuery ?? "")
            : undefined,
        signal: controller.signal,
      });
      clearTimeout(timer);
      const latency = Date.now() - started;
      const text = (await res.text()).slice(0, 8000);
      if (a.id) {
        const db = await admin();
        await db
          .from("custom_apis")
          .update({
            last_status: res.ok ? `ok ${res.status}` : `http ${res.status}`,
            last_latency_ms: latency,
            last_checked_at: new Date().toISOString(),
          })
          .eq("id", a.id);
      }
      await log({
        api_id: a.id ?? null,
        api_slug: a.slug ?? null,
        action: "test",
        ok: res.ok,
        status_code: res.status,
        latency_ms: latency,
      });
      return { ok: res.ok, status: res.status, latency, body: text, url: url.toString() };
    } catch (e: any) {
      const latency = Date.now() - started;
      const message = String(e?.message ?? e).slice(0, 300);
      if (a.id) {
        const db = await admin();
        await db
          .from("custom_apis")
          .update({
            last_status: `error: ${message.slice(0, 80)}`,
            last_latency_ms: latency,
            last_checked_at: new Date().toISOString(),
          })
          .eq("id", a.id);
      }
      await log({ api_id: a.id ?? null, action: "test", ok: false, latency_ms: latency, message });
      return { ok: false, status: 0, latency, body: message, url: "" };
    }
  });

/* --------------------------- import / export --------------------------- */

export const exportApis = createServerFn({ method: "GET" }).handler(async () => {
  await requireUnlocked();
  const db = await admin();
  const { data, error } = await db.from("custom_apis").select("*").is("deleted_at", null);
  if (error) throw new Error(error.message);
  await log({ action: "export", ok: true });
  return { exported_at: new Date().toISOString(), apis: data ?? [] };
});

export const importApis = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        confirmPassword: z.string().min(1),
        apis: z.array(ApiSchema.omit({ id: true })).min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await requireConfirmed(data.confirmPassword);
    const db = await admin();
    const rows = data.apis.map((a) => ({
      slug: a.slug,
      name: a.name,
      category: a.category,
      description: a.description ?? null,
      base_url: a.base_url,
      path: a.path,
      method: a.method,
      headers: a.headers,
      query_params: a.query_params,
      body_template: a.body_template ?? null,
      auth_type: a.auth_type,
      auth_value: a.auth_value ?? null,
      timeout_ms: a.timeout_ms,
      enabled: a.enabled,
      priority: a.priority,
      tags: a.tags,
    }));
    const { error } = await db.from("custom_apis").upsert(rows, { onConflict: "slug" });
    if (error) throw new Error(error.message);
    await log({ action: "import", ok: true, message: `${rows.length} entries` });
    return { ok: true as const, count: rows.length };
  });
