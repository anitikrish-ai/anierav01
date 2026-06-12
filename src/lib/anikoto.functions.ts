import { createServerFn } from "@tanstack/react-start";

const BASE = "http://anikotoapi.site";

export interface AnikotoEpisode {
  number: number;
  title?: string | null;
  embed_url?: { sub?: string | null; dub?: string | null } | null;
}

export interface AnikotoSeries {
  id: string | number;
  title: string;
  episodes: AnikotoEpisode[];
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Search Anikoto by title across the first few pages of /recent-anime.
 * Server-side only so we don't burn the user's IP rate-limit.
 */
export const searchAnikotoByTitle = createServerFn({ method: "GET" })
  .inputValidator((d: { title: string }) => d)
  .handler(async ({ data }) => {
    const target = normalize(data.title);
    if (!target) return null;
    for (let page = 1; page <= 3; page++) {
      let r: Response;
      try {
        r = await fetch(`${BASE}/recent-anime?page=${page}&per_page=50`, {
          headers: { Accept: "application/json" },
        });
      } catch {
        return null;
      }
      if (!r.ok) return null;
      const j: any = await r.json().catch(() => null);
      const rows: any[] = j?.data ?? j?.items ?? j?.results ?? [];
      if (!rows.length) break;
      const hit = rows.find((row: any) => {
        const t: string = row?.title ?? row?.name ?? "";
        if (!t) return false;
        const n = normalize(t);
        return n === target || n.includes(target) || target.includes(n);
      });
      if (hit) return { id: String(hit.id ?? hit.slug ?? hit.dataId ?? ""), title: String(hit.title ?? hit.name ?? "") };
    }
    return null;
  });

/**
 * Load a full Anikoto series payload (episodes + embed urls).
 */
export const getAnikotoSeries = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }): Promise<AnikotoSeries | null> => {
    if (!data.id) return null;
    let r: Response;
    try {
      r = await fetch(`${BASE}/series/${encodeURIComponent(data.id)}`, {
        headers: { Accept: "application/json" },
      });
    } catch {
      return null;
    }
    if (!r.ok) return null;
    const j: any = await r.json().catch(() => null);
    const raw = j?.data ?? j;
    if (!raw) return null;
    const episodes: AnikotoEpisode[] = (raw.episodes ?? []).map((e: any) => ({
      number: Number(e.number ?? e.ep ?? 0),
      title: e.title ?? null,
      embed_url: e.embed_url ?? null,
    }));
    return {
      id: raw.id ?? data.id,
      title: raw.title ?? raw.name ?? "",
      episodes,
    };
  });