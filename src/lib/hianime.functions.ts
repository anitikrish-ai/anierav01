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
  intro?: { start: number; end: number } | null;
  outro?: { start: number; end: number } | null;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Resolve a HiAnime episode and return playable HLS sources + subtitle tracks.
 * Uses the `hianime` scraper SDK. Runs server-side only.
 */
export const getHianimeSources = createServerFn({ method: "GET" })
  .inputValidator((d: { title: string; ep: number; lang: "sub" | "dub" }) => d)
  .handler(async ({ data }): Promise<HianimeResult | null> => {
    try {
      const mod: any = await import("hianime");
      const Hianime = mod.Hianime ?? mod.default?.Hianime ?? mod.default;
      if (!Hianime) return null;
      const client = new Hianime();

      // 1) Search the catalogue
      const target = norm(data.title);
      let dataId: string | null = null;
      try {
        const search = await client.search(data.title);
        const rows: any[] = search?.results ?? search?.data ?? [];
        const hit =
          rows.find((r) => norm(r.title ?? "") === target) ??
          rows.find((r) => norm(r.title ?? "").includes(target)) ??
          rows[0];
        dataId = hit?.dataId ?? hit?.id ?? null;
      } catch {
        return null;
      }
      if (!dataId) return null;

      // 2) Episode list → pick by number
      const episodes: any[] = await client.getEpisodes(dataId).catch(() => []);
      const epRow =
        episodes.find((e) => Number(e.number) === data.ep) ??
        episodes[data.ep - 1];
      const episodeId: string | null = epRow?.id ?? null;
      if (!episodeId) return null;

      // 3) Servers
      const servers = await client.getEpisodeServers(episodeId).catch(() => null);
      if (!servers) return null;
      const list: any[] = (data.lang === "dub" ? servers.dub : servers.sub) ?? [];
      if (!list.length) return null;

      // 4) Try each server until one returns sources
      for (const srv of list) {
        try {
          const out = await client.getEpisodeSources(srv.id);
          const sources: HianimeSource[] = (out?.sources ?? []).map((s: any) => ({
            file: s.file ?? s.url,
            type: s.type ?? "hls",
          })).filter((s: any) => !!s.file);
          if (!sources.length) continue;
          const tracks: HianimeTrack[] = (out?.tracks ?? []).map((t: any) => ({
            file: t.file ?? t.url,
            label: t.label,
            kind: t.kind ?? "captions",
            default: t.default === true || t.label === "English",
          })).filter((t: any) => !!t.file);
          return {
            sources,
            tracks,
            episodeId,
            serverName: srv.name ?? null,
            lang: data.lang,
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
