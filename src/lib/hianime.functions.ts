import { createServerFn } from "@tanstack/react-start";

export interface HianimeTrack {
  file: string;
  label?: string;
  kind?: string;
  default?: boolean;
}
export interface HianimeSource {
  file: string;
  type?: string;
}
export interface HianimeResult {
  sources: HianimeSource[];
  tracks: HianimeTrack[];
  episodeId: string | null;
  serverName: string | null;
  lang: "sub" | "dub";
  intro?: { start?: number; end?: number } | null;
  outro?: { start?: number; end?: number } | null;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Resolve a HiAnime episode and return playable HLS sources + subtitle tracks.
 * Prefers MAL ID lookup (exact) and falls back to title search.
 */
export const getHianimeSources = createServerFn({ method: "GET" })
  .inputValidator((d: { malId?: number; title?: string; ep: number; lang: "sub" | "dub" }) => d)
  .handler(async ({ data }): Promise<HianimeResult | null> => {
    try {
      const mod: any = await import("hianime");
      const Hianime = mod.Hianime ?? mod.default?.Hianime ?? mod.default;
      if (!Hianime) return null;
      const client = new Hianime();

      // 1) Resolve episode list — prefer MAL ID (exact), fallback to title search.
      let episodes: any[] = [];
      if (data.malId) {
        try {
          episodes = await client.getEpisodesByMALID(String(data.malId));
        } catch {
          episodes = [];
        }
      }
      if (!episodes.length && data.title) {
        try {
          const search = await client.search(data.title);
          const rows: any[] = search?.results ?? [];
          const target = norm(data.title);
          const hit =
            rows.find((r) => norm(r.title ?? "") === target) ??
            rows.find((r) => norm(r.title ?? "").includes(target)) ??
            rows[0];
          const dataId: string | null = hit?.dataId ?? hit?.id ?? null;
          if (dataId) episodes = await client.getEpisodes(dataId).catch(() => []);
        } catch {
          // ignore
        }
      }
      if (!episodes.length) return null;

      // 2) Pick episode by number, fallback to index.
      const epRow =
        episodes.find((e) => Number(e.number) === data.ep) ??
        episodes[data.ep - 1];
      const episodeId: string | null = epRow?.id ?? null;
      if (!episodeId) return null;

      // 3) Fetch server list for the requested language, fallback to the other.
      const servers = await client.getEpisodeServers(episodeId).catch(() => null);
      if (!servers) return null;
      const primary: any[] = (data.lang === "dub" ? servers.dub : servers.sub) ?? [];
      const fallback: any[] = (data.lang === "dub" ? servers.sub : servers.dub) ?? [];
      const candidates = [...primary, ...fallback];
      if (!candidates.length) return null;

      // 4) Try each server until one returns sources.
      for (const srv of candidates) {
        try {
          const out = await client.getEpisodeSources(srv.id);
          const sources: HianimeSource[] = (out?.sources ?? [])
            .map((s: any) => ({ file: s.file ?? s.url, type: s.type ?? "hls" }))
            .filter((s: any) => !!s.file);
          if (!sources.length) continue;
          const tracks: HianimeTrack[] = (out?.tracks ?? [])
            .map((t: any) => ({
              file: t.file ?? t.url,
              label: t.label,
              kind: t.kind ?? "captions",
              default: t.default === true || t.label === "English",
            }))
            .filter((t: any) => !!t.file);
          return {
            sources,
            tracks,
            episodeId,
            serverName: srv.name ?? null,
            lang: (primary.includes(srv) ? data.lang : data.lang === "dub" ? "sub" : "dub"),
            intro: out?.intro ?? null,
            outro: out?.outro ?? null,
          };
        } catch {
          continue;
        }
      }
      return null;
    } catch (e) {
      console.error("[hianime] error", e);
      return null;
    }
  });
