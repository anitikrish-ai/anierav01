import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { jikan, bestTitle } from "@/lib/jikan";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  saveHistory,
  markEpisodeWatched,
  getEpisodeProgress,
  saveEpisodeProgress,
  getPreferredProvider,
  setPreferredProvider,
  getPreferredLang,
  setPreferredLang,
} from "@/lib/history";
import { malToAnilist } from "@/lib/anilist";
import { searchAnikotoByTitle, getAnikotoSeries, type AnikotoSeries } from "@/lib/anikoto.functions";
import { getHianimeSources } from "@/lib/hianime.functions";
import { HlsPlayer } from "@/components/HlsPlayer";

type Lang = "sub" | "dub";

interface ServerDef {
  id: string;
  label: string;
  /** Returns an embed URL, or null if this server cannot serve this request. */
  build: (ctx: { malId: number; anilistId: number | null; anikoto: AnikotoSeries | null; ep: number; lang: Lang }) => string | null;
}

const SERVERS: ServerDef[] = [
  {
    id: "hianime-direct",
    label: "HiAnime Direct (HLS)",
    // Sentinel string — actual sources fetched via getHianimeSources server fn.
    build: () => "hianime-direct://",
  },
  {
    id: "hianime-sub",
    label: "HiAnime (Episode ID)",
    build: ({ anikoto, ep, lang }) => {
      if (!anikoto) return null;
      const match = anikoto.episodes.find(e => e.number === ep);
      const epId = match?.episode_id;
      if (!epId) return null;
      return `https://megaplay.buzz/stream/s-2/${epId}/${lang}`;
    },
  },
  {
    id: "vidnest-mal",
    label: "VidNest (MAL)",
    build: ({ malId, ep, lang }) => `https://vidnest.fun/anime/${malId}/${ep}/${lang}`,
  },
  {
    id: "vidnest-al",
    label: "VidNest (AniList)",
    build: ({ anilistId, ep, lang }) =>
      anilistId ? `https://vidnest.fun/anime/${anilistId}/${ep}/${lang}` : null,
  },
  {
    id: "megaplay-mal",
    label: "MegaPlay (MAL)",
    build: ({ malId, ep, lang }) => `https://megaplay.buzz/stream/s-2/${malId}-${ep}/${lang}`,
  },
  {
    id: "megaplay-al",
    label: "MegaPlay (AniList)",
    build: ({ anilistId, ep, lang }) =>
      anilistId ? `https://megaplay.buzz/stream/s-2/${anilistId}-${ep}/${lang}` : null,
  },
  {
    id: "tryembed-al",
    label: "TryEmbed (AniList)",
    build: ({ anilistId, ep, lang }) =>
      anilistId ? `https://tryembed.us.cc/embed/anime/${anilistId}/${ep}/${lang}` : null,
  },
  {
    id: "4animo-al",
    label: "4Animo (AniList)",
    build: ({ anilistId, ep, lang }) =>
      anilistId ? `https://cdn.4animo.xyz/embed/hd-1/ani/${anilistId}/${ep}/${lang}?k=1` : null,
  },
  {
    id: "megaplay-ani-al",
    label: "MegaPlay ani (AniList)",
    build: ({ anilistId, ep, lang }) =>
      anilistId ? `https://megaplay.buzz/stream/ani/${anilistId}/${ep}/${lang}` : null,
  },
  {
    id: "2anime",
    label: "2anime",
    build: ({ malId, ep }) => `https://2anime.xyz/embed/${malId}-episode-${ep}`,
  },
  {
    id: "anikoto",
    label: "Anikoto",
    build: ({ anikoto, ep, lang }) => {
      if (!anikoto) return null;
      const match = anikoto.episodes.find(e => e.number === ep);
      const url = match?.embed_url?.[lang] ?? match?.embed_url?.sub ?? match?.embed_url?.dub ?? null;
      return url || null;
    },
  },
];

export const Route = createFileRoute("/watch/$id/$ep")({
  head: ({ params }) => {
    const url = `https://aniera.lovable.app/watch/${params.id}/${params.ep}`;
    return {
      meta: [
        { title: `Episode ${params.ep} — Watch on AniEra` },
        { name: "description", content: `Stream episode ${params.ep} on AniEra with sub & dub, multi-server playback, and a frosted-glass player.` },
        { property: "og:title", content: `Episode ${params.ep} — AniEra` },
        { property: "og:type", content: "video.episode" },
        { property: "og:url", content: url },
        { name: "robots", content: "noindex" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "VideoObject",
            name: `Episode ${params.ep}`,
            description: `Anime episode ${params.ep} streaming on AniEra`,
            uploadDate: new Date().toISOString(),
            embedUrl: url,
          }),
        },
      ],
    };
  },
  component: WatchPage,
});

function WatchPage() {
  const { id, ep } = Route.useParams();
  const navigate = useNavigate();
  const malId = Number(id);
  const epNum = Number(ep);
  const [serverIdx, setServerIdx] = useState(0);
  const [lang, setLang] = useState<Lang>("sub");
  const [iframeKey, setIframeKey] = useState(0);
  const [loadState, setLoadState] = useState<"loading" | "ok" | "stalled">("loading");
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const animeQ = useQuery({ queryKey: ["anime", malId], queryFn: () => jikan.anime(malId) });
  const a = animeQ.data?.data;
  const total = a?.episodes ?? null;
  const title = a ? bestTitle(a) : "";

  // MAL → AniList mapping (cached). Drives AniList-keyed embed servers.
  const anilistQ = useQuery({
    queryKey: ["anilist", malId],
    queryFn: () => malToAnilist(malId),
    staleTime: Infinity,
  });

  // Anikoto title search → series payload (server-side, rate-limit safe).
  const anikotoSearchQ = useQuery({
    queryKey: ["anikoto-search", title],
    queryFn: () => searchAnikotoByTitle({ data: { title } }),
    enabled: !!title,
    staleTime: 1000 * 60 * 60,
  });
  const anikotoSeriesQ = useQuery({
    queryKey: ["anikoto-series", anikotoSearchQ.data?.id],
    queryFn: () => getAnikotoSeries({ data: { id: String(anikotoSearchQ.data!.id) } }),
    enabled: !!anikotoSearchQ.data?.id,
    staleTime: 1000 * 60 * 60,
  });

  const ctx = useMemo(
    () => ({
      malId,
      anilistId: anilistQ.data ?? null,
      anikoto: anikotoSeriesQ.data ?? null,
      ep: epNum,
      lang,
    }),
    [malId, anilistQ.data, anikotoSeriesQ.data, epNum, lang],
  );

  // HiAnime direct sources (only fetched when that server is active).
  const hianimeQ = useQuery({
    queryKey: ["hianime-src", title, epNum, lang],
    queryFn: () => getHianimeSources({ data: { title, ep: epNum, lang } }),
    enabled: !!title,
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  // Resolve current server's embed, skipping forward if this server can't serve this request.
  const { embed, activeServer } = useMemo(() => {
    for (let i = 0; i < SERVERS.length; i++) {
      const idx = (serverIdx + i) % SERVERS.length;
      const url = SERVERS[idx].build(ctx);
      if (url) return { embed: url, activeServer: SERVERS[idx] };
    }
    return { embed: null as string | null, activeServer: SERVERS[0] };
  }, [serverIdx, ctx]);

  // Reset load watcher whenever the embed changes; auto-flag stalled after 12s.
  useEffect(() => {
    setLoadState("loading");
    if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    if (!embed) return;
    stallTimerRef.current = setTimeout(() => {
      setLoadState(prev => (prev === "loading" ? "stalled" : prev));
    }, 12000);
    return () => { if (stallTimerRef.current) clearTimeout(stallTimerRef.current); };
  }, [embed]);

  const tryNextServer = () => {
    setServerIdx(i => (i + 1) % SERVERS.length);
    setIframeKey(k => k + 1);
  };

  const selectServer = (id: string) => {
    const idx = SERVERS.findIndex(s => s.id === id);
    if (idx >= 0) {
      setServerIdx(idx);
      setIframeKey(k => k + 1);
    }
  };

  useEffect(() => {
    if (!a) return;
    saveHistory({
      malId,
      title: bestTitle(a),
      image: a.images.webp?.large_image_url || a.images.jpg.large_image_url,
      episode: epNum,
      totalEpisodes: total,
      lang,
      updatedAt: Date.now(),
    });
    markEpisodeWatched(malId, epNum);
  }, [a, malId, epNum, lang, total]);

  const goEp = (next: number) => {
    if (next < 1) return;
    if (total && next > total) return;
    navigate({ to: "/watch/$id/$ep", params: { id, ep: String(next) } });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-white/70">
        <Link to="/" className="hover:text-white">Home</Link>
        <span>/</span>
        {a ? (
          <Link to="/anime/$id" params={{ id }} className="hover:text-white">{bestTitle(a)}</Link>
        ) : <span>Loading…</span>}
        <span>/</span>
        <span className="text-white">Episode {epNum}</span>
      </div>

      <div className="overflow-hidden rounded-3xl glass-strong">
        <div className="relative aspect-video w-full bg-black">
          {activeServer.id === "hianime-direct" ? (
            hianimeQ.isLoading ? (
              <div className="flex h-full w-full items-center justify-center text-sm text-white/60">
                Resolving HiAnime stream…
              </div>
            ) : hianimeQ.data?.sources?.[0]?.file ? (
              <HlsPlayer
                key={`${hianimeQ.data.sources[0].file}-${iframeKey}`}
                src={hianimeQ.data.sources[0].file}
                tracks={hianimeQ.data.tracks}
                poster={a?.images.webp?.large_image_url || a?.images.jpg.large_image_url}
                onEnded={() => goEp(epNum + 1)}
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-white/60">
                <span>HiAnime direct stream not found for this episode.</span>
                <button onClick={tryNextServer} className="rounded-md bg-gradient-to-r from-neon-cyan to-neon-magenta px-3 py-1 text-xs font-semibold text-background">
                  Try next server →
                </button>
              </div>
            )
          ) : embed ? (
            <iframe
              key={`${embed}-${iframeKey}`}
              src={embed}
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
              allowFullScreen
              referrerPolicy="no-referrer"
              onLoad={() => setLoadState("ok")}
              onError={() => tryNextServer()}
              className="h-full w-full"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-white/60">
              No server available for this episode.
            </div>
          )}
          {loadState === "stalled" && (
            <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-2 bg-black/70 px-4 py-2 text-xs text-white/90 backdrop-blur">
              <span>Stream slow or unavailable on <b>{activeServer.label}</b>.</span>
              <button
                onClick={tryNextServer}
                className="rounded-md bg-gradient-to-r from-neon-cyan to-neon-magenta px-3 py-1 font-semibold text-background"
              >
                Try next server →
              </button>
            </div>
          )}
        </div>
        <div className="grid gap-3 p-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate font-display text-lg font-bold text-white">
              {a ? bestTitle(a) : "Loading…"} <span className="text-neon-cyan">· EP {epNum}</span>
            </h1>
            <p className="mt-0.5 text-[11px] text-white/50">
              MAL #{malId}
              {anilistQ.data ? <> · AniList #{anilistQ.data}</> : anilistQ.isLoading ? <> · AniList…</> : null}
              {anikotoSeriesQ.data ? <> · Anikoto ✓</> : null}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Toggle value={lang} options={[["sub", "SUB"], ["dub", "DUB"]]} onChange={v => setLang(v as Lang)} />
            <select
              value={activeServer.id}
              onChange={e => selectServer(e.target.value)}
              className="rounded-lg bg-white/5 px-3 py-2 text-xs text-white outline-none ring-1 ring-white/10 focus:ring-neon-cyan"
            >
              {SERVERS.map(s => {
                const available = !!s.build(ctx);
                return (
                  <option key={s.id} value={s.id} disabled={!available} className="bg-background">
                    {available ? "Server" : "Unavailable"}: {s.label}
                  </option>
                );
              })}
            </select>
            <button onClick={tryNextServer}
              className="rounded-lg glass px-3 py-2 text-xs font-medium text-white hover:bg-white/10">
              ↻ Next server
            </button>
            <button onClick={() => goEp(epNum - 1)} disabled={epNum <= 1}
              className="rounded-lg glass px-3 py-2 text-xs font-medium text-white disabled:opacity-40">
              ← Prev
            </button>
            <button onClick={() => goEp(epNum + 1)} disabled={!!total && epNum >= total}
              className="rounded-lg bg-gradient-to-r from-neon-cyan to-neon-magenta px-3 py-2 text-xs font-semibold text-background disabled:opacity-40">
              Next →
            </button>
          </div>
        </div>
      </div>

      {a && (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold text-white">Episodes</h2>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12">
            {Array.from({ length: total ?? 12 }).map((_, i) => {
              const n = i + 1;
              const active = n === epNum;
              return (
                <Link key={n} to="/watch/$id/$ep" params={{ id, ep: String(n) }}
                  className={`rounded-lg px-2 py-2 text-center text-xs font-semibold transition ${
                    active ? "bg-gradient-to-r from-neon-cyan to-neon-magenta text-background" : "glass text-white/80 hover:text-white"
                  }`}>
                  {n}
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function Toggle({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="glass flex rounded-lg p-0.5">
      {options.map(([val, label]) => (
        <button
          key={val}
          onClick={() => onChange(val)}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
            value === val ? "bg-white/15 text-neon-cyan" : "text-white/70 hover:text-white"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}