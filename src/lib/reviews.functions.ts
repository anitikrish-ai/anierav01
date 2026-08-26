import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export interface ReviewRow {
  id: string;
  user_id: string;
  mal_id: number;
  rating: number | null;
  body: string;
  spoiler: boolean;
  author_name: string;
  author_avatar: string | null;
  created_at: string;
  updated_at: string;
}

const ReviewInput = z.object({
  mal_id: z.number().int().positive(),
  anime_title: z.string().min(1).max(500),
  rating: z.number().int().min(1).max(10).nullable(),
  body: z.string().min(2).max(4000),
  spoiler: z.boolean().default(false),
  author_name: z.string().min(1).max(80),
  author_avatar: z.string().url().max(1000).nullable().optional(),
});

/** Public: everyone can read reviews for an anime. */
export const listReviews = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ mal_id: z.number().int().positive() }).parse(d))
  .handler(async ({ data }) => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const supabasePublic = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { data: rows, error } = await supabasePublic
      .from("anime_reviews")
      .select("id,user_id,mal_id,rating,body,spoiler,author_name,author_avatar,created_at,updated_at")
      .eq("mal_id", data.mal_id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return { reviews: [] as ReviewRow[], error: "Reviews unavailable right now." };
    return { reviews: (rows ?? []) as ReviewRow[], error: null as string | null };
  });

/** Create or update the signed-in user's review for an anime. */
export const upsertReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ReviewInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("anime_reviews")
      .upsert(
        { ...data, author_avatar: data.author_avatar ?? null, user_id: context.userId },
        { onConflict: "user_id,mal_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Delete the signed-in user's own review (admins may delete any). */
export const deleteReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("anime_reviews").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
