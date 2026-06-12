import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const StatusEnum = z.enum(["watching", "completed", "plan_to_watch", "on_hold", "dropped"]);

const EntrySchema = z.object({
  mal_id: z.number().int().positive(),
  title: z.string().min(1).max(500),
  image: z.string().url().max(1000).nullish(),
  status: StatusEnum.default("watching"),
  score: z.number().int().min(0).max(10).nullish(),
  episodes_watched: z.number().int().min(0).max(10000).default(0),
  total_episodes: z.number().int().min(0).max(10000).nullish(),
  is_favorite: z.boolean().default(false),
  notes: z.string().max(2000).nullish(),
});

export type LibraryEntryRow = z.infer<typeof EntrySchema> & { id: string; updated_at: string };

/** List the signed-in user's full library. */
export const listLibrary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("library_entries")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Upsert (create or update) a single entry. */
export const upsertEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EntrySchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("library_entries")
      .upsert({ ...data, user_id: context.userId }, { onConflict: "user_id,mal_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Delete a single entry. */
export const deleteEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ mal_id: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("library_entries")
      .delete()
      .eq("mal_id", data.mal_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Bulk import — used by file import and MAL list pull. */
export const bulkUpsert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ entries: z.array(EntrySchema).max(5000) }).parse(d))
  .handler(async ({ data, context }) => {
    if (!data.entries.length) return { inserted: 0 };
    const rows = data.entries.map(e => ({ ...e, user_id: context.userId }));
    // Chunk to keep request size reasonable
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const { error } = await context.supabase
        .from("library_entries")
        .upsert(chunk, { onConflict: "user_id,mal_id" });
      if (error) throw new Error(error.message);
      inserted += chunk.length;
    }
    return { inserted };
  });

/** Read the signed-in user's profile. */
export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles").select("*").eq("id", context.userId).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

/** Update display name / avatar / linked MAL username. */
export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      display_name: z.string().trim().max(80).nullish(),
      avatar_url: z.string().url().max(1000).nullish(),
      mal_username: z.string().trim().regex(/^[A-Za-z0-9_-]{2,30}$/).nullish(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .upsert({ id: context.userId, ...data })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Pull a public MAL list via Jikan and import it. Runs server-side to avoid CORS & rate-limit on user IPs. */
export const importFromMal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ username: z.string().trim().regex(/^[A-Za-z0-9_-]{2,30}$/) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const collected: Array<z.infer<typeof EntrySchema>> = [];
    // Jikan returns up to 25 per page (with pagination.has_next_page).
    for (let page = 1; page <= 20; page++) {
      const r = await fetch(`https://api.jikan.moe/v4/users/${encodeURIComponent(data.username)}/animelist?page=${page}`);
      if (r.status === 404) throw new Error("MAL user not found");
      if (!r.ok) throw new Error(`Jikan error ${r.status}`);
      const json: any = await r.json();
      const rows: any[] = json?.data ?? [];
      for (const row of rows) {
        const anime = row?.anime ?? {};
        const malId = Number(anime?.mal_id);
        if (!malId) continue;
        const statusRaw: string = String(row?.watch_status ?? row?.status ?? "").toLowerCase();
        const status =
          statusRaw.includes("complet") ? "completed" :
          statusRaw.includes("plan") ? "plan_to_watch" :
          statusRaw.includes("hold") ? "on_hold" :
          statusRaw.includes("drop") ? "dropped" : "watching";
        collected.push({
          mal_id: malId,
          title: String(anime?.title ?? `Anime ${malId}`),
          image: anime?.images?.jpg?.image_url ?? null,
          status,
          score: row?.score != null ? Number(row.score) || null : null,
          episodes_watched: Number(row?.episodes_watched ?? 0) || 0,
          total_episodes: anime?.episodes != null ? Number(anime.episodes) || null : null,
          is_favorite: false,
          notes: null,
        });
      }
      if (!json?.pagination?.has_next_page) break;
    }
    if (!collected.length) return { inserted: 0 };
    const rows = collected.map(e => ({ ...e, user_id: context.userId }));
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const { error } = await context.supabase
        .from("library_entries")
        .upsert(chunk, { onConflict: "user_id,mal_id" });
      if (error) throw new Error(error.message);
    }
    return { inserted: collected.length };
  });