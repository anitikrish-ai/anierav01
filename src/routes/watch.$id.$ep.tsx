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
  getWatchedEpisodes,
} from "@/lib/history";
import { malToAnilist } from "@/lib/anilist";
import {
  searchAnikotoByTitle,
  getAnikotoSeries,
  type AnikotoSeries,
} from "@/lib/anikoto.functions";
import { getHianimeSources } from "@/lib/hianime.functions";
import { HlsPlayer } from "@/components/HlsPlayer";
import {
  GlassButton,
  GlassSegmented,
  GlassSheet,
  GlassSwitch,
  GlassSlider,
  GlassCard,
} from "@zakisheriff/liquid-glass";
import { List, Settings2, Sparkles, Share2, Check } from "lucide-react";

type Lang = "sub" | "dub";

interface ServerDef {
  id: string;
  label: string;
  /** Returns an embed URL, or null if this server cannot serve this request. */
  build: (ctx: {
    malId: number;
    anilistId: number | null;
    anikoto: AnikotoSeries | null;
    ep: number;
    lang: Lang;
  }) => string | null;
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
      const match = anikoto.episodes.find((e) => e.number === ep);
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
      const match = anikoto.episodes.find((e) => e.number === ep);
      const url =
        match?.embed_url?.[lang] ?? match?.embed_url?.sub ?? match?.embed_url?.dub ?? null;
      return url || null;
    },
  },
];

export const Route = createFileRoute("/watch/$id/$ep")({
  head: ({ params }) => {
    const url = `https://aniera.lovable.app/watch/${params.id}/${params.ep}`;
    return {
      meta: [
        {
          property: "og:description",
          content: `Stream episode ${params.ep} on AniEra with sub and dub playback.`,
        },
        { name: "twitter:card", content: "summary" },
        { title: `Episode ${params.ep} — Watch on AniEra` },
        {
          name: "description",
          content: `Stream episode ${params.ep} on AniEra with sub & dub, multi-server playback, and a frosted-glass player.`,
        },
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
  const [serverIdx, setServerIdx] = useState(() => {
    if (typeof window === "undefined") return 0;
    const preferred = getPreferredProvider(malId);
    const i = preferred ? SERVERS.findIndex((s) => s.id === preferred) : -1;
    return i >= 0 ? i : 0;
  });
  const [lang, setLang] = useState<Lang>(() => getPreferredLang());
  const [iframeKey, setIframeKey] = useState(0);
  const [loadState, setLoadState] = useState<"loading" | "ok" | "stalled">("loading");
  const [showNextHint, setShowNextHint] = useState(false);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resume position for the current episode (seconds).
  const resume = useMemo(() => getEpisodeProgress(malId, epNum)?.t ?? 0, [malId, epNum]);

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
    queryKey: ["hianime-src", malId, title, epNum, lang],
    queryFn: () => getHianimeSources({ data: { malId, title, ep: epNum, lang } }),
    enabled: !!malId,
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
      setLoadState((prev) => (prev === "loading" ? "stalled" : prev));
    }, 12000);
    return () => {
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    };
  }, [embed]);

  const tryNextServer = () => {
    setServerIdx((i) => {
      const next = (i + 1) % SERVERS.length;
      setPreferredProvider(malId, SERVERS[next].id);
      return next;
    });
    setIframeKey((k) => k + 1);
  };

  const selectServer = (id: string) => {
    const idx = SERVERS.findIndex((s) => s.id === id);
    if (idx >= 0) {
      setServerIdx(idx);
      setPreferredProvider(malId, id);
      setIframeKey((k) => k + 1);
    }
  };

  const selectLang = (v: Lang) => {
    setLang(v);
    setPreferredLang(v);
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

  const [episodeSheetOpen, setEpisodeSheetOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ambientGlow, setAmbientGlow] = useState(true);
  const [ambientIntensity, setAmbientIntensity] = useState(55);
  const [autoplayNext, setAutoplayNext] = useState(true);
  const [copied, setCopied] = useState(false);

  const watchedEpisodes = useMemo(() => getWatchedEpisodes(malId), [malId]);

  const goEp = (next: number) => {
    if (next < 1) return;
    if (total && next > total) return;
    setShowNextHint(false);
    navigate({ to: "/watch/$id/$ep", params: { id, ep: String(next) } });
  };

  // Dismiss the "Next Episode" hint on any user interaction.
  useEffect(() => {
    if (!showNextHint) return;
    const dismiss = () => setShowNextHint(false);
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "wheel", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, dismiss, { passive: true, once: true }));
    return () => events.forEach((e) => window.removeEventListener(e, dismiss));
  }, [showNextHint]);

  // Reset hint when episode changes.
  useEffect(() => {
    setShowNextHint(false);
  }, [epNum, malId]);

  const handleShare = async () => {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-white/70">
        <div className="flex items-center gap-2">
          <Link to="/" className="hover:text-white">
            Home
          </Link>
          <span>/</span>
          {a ? (
            <Link to="/anime/$id" params={{ id }} className="hover:text-white">
              {bestTitle(a)}
            </Link>
          ) : (
            <span>Loading…</span>
          )}
          <span>/</span>
          <span className="text-white font-medium">Episode {epNum}</span>
        </div>

        <GlassButton
          variant="clear"
          size="sm"
          icon={copied ? <Check size={14} /> : <Share2 size={14} />}
          onClick={handleShare}
        >
          {copied ? "Copied Link" : "Share"}
        </GlassButton>
      </div>

      <div className="relative">
        {/* Dynamic ambient optical glow behind the player */}
        {ambientGlow && (
          <div
            className="pointer-events-none absolute -inset-4 sm:-inset-6 rounded-3xl blur-3xl transition-opacity duration-300 -z-10"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(139, 92, 246, 0.45), rgba(56, 189, 248, 0.25), transparent 70%)",
              opacity: ambientIntensity / 100,
            }}
          />
        )}

        <div className="overflow-hidden rounded-3xl glass-strong border border-white/10 shadow-2xl">
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
                  startTime={resume}
                  onProgress={(t, d) => saveEpisodeProgress(malId, epNum, t, d)}
                  onEnded={() => {
                    if (autoplayNext && (!total || epNum < total)) {
                      goEp(epNum + 1);
                    } else if (!total || epNum < total) {
                      setShowNextHint(true);
                    }
                  }}
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-white/60">
                  <span>HiAnime direct stream not found for this episode.</span>
                  <button
                    onClick={tryNextServer}
                    className="rounded-md bg-gradient-to-r from-neon-cyan to-neon-magenta px-3 py-1 text-xs font-semibold text-background"
                  >
                    Try next server →
                  </button>
                </div>
              )
            ) : embed ? (
              <iframe
                key={`${embed}-${iframeKey}`}
                src={embed}
                sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
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
                <span>
                  Stream slow or unavailable on <b>{activeServer.label}</b>.
                </span>
                <button
                  onClick={tryNextServer}
                  className="rounded-md bg-gradient-to-r from-neon-cyan to-neon-magenta px-3 py-1 font-semibold text-background"
                >
                  Try next server →
                </button>
              </div>
            )}
          </div>

          {/* Interactive Player Controls Row */}
          <div className="grid gap-3 p-3 sm:p-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between border-t border-white/5">
            <div className="min-w-0">
              <h1 className="truncate text-base sm:text-lg font-bold text-white">
                {a ? bestTitle(a) : "Loading…"} <span className="text-cyan-400">· EP {epNum}</span>
              </h1>
              <p className="mt-0.5 text-[11px] text-white/50">
                MAL #{malId}
                {anilistQ.data ? <> · AniList #{anilistQ.data}</> : null}
                {anikotoSeriesQ.data ? <> · Anikoto ✓</> : null}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <GlassSegmented
                options={["SUB", "DUB"]}
                value={lang === "sub" ? 0 : 1}
                onChange={(idx) => selectLang(idx === 0 ? "sub" : "dub")}
                size="sm"
                intensity={4}
                aria-label="Audio language"
              />

              {/* Mobile Episodes Drawer Button */}
              <GlassButton
                variant="tinted"
                tint="#8b5cf6"
                size="sm"
                icon={<List size={14} />}
                onClick={() => setEpisodeSheetOpen(true)}
                className="sm:hidden"
              >
                Episodes ({epNum}/{total || "?"})
              </GlassButton>

              <select
                value={activeServer.id}
                onChange={(e) => selectServer(e.target.value)}
                className="rounded-xl bg-white/5 px-2.5 py-1.5 text-xs text-white outline-none ring-1 ring-white/10 focus:ring-primary"
              >
                {SERVERS.map((s) => {
                  const available = !!s.build(ctx);
                  return (
                    <option key={s.id} value={s.id} disabled={!available} className="bg-background">
                      {available ? "Server" : "Unavailable"}: {s.label}
                    </option>
                  );
                })}
              </select>

              <GlassButton
                variant="clear"
                size="sm"
                onClick={tryNextServer}
                title="Switch to next server"
              >
                ↻ Next server
              </GlassButton>

              <GlassButton
                variant={settingsOpen ? "filled" : "clear"}
                size="sm"
                icon={<Settings2 size={14} />}
                onClick={() => setSettingsOpen((v) => !v)}
                title="Player Settings"
              >
                Settings
              </GlassButton>

              <GlassButton
                variant="clear"
                size="sm"
                onClick={() => goEp(epNum - 1)}
                disabled={epNum <= 1}
              >
                ← Prev
              </GlassButton>

              <div className="relative">
                {showNextHint && (
                  <span
                    aria-hidden="true"
                    className="next-ep-hint pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-bold uppercase"
                  >
                    Next Episode →
                  </span>
                )}
                <GlassButton
                  variant="filled"
                  tint="#8b5cf6"
                  size="sm"
                  onClick={() => goEp(epNum + 1)}
                  disabled={!!total && epNum >= total}
                  className={
                    showNextHint
                      ? "ring-2 ring-cyan-400/70 shadow-[0_0_20px_rgba(34,211,238,0.6)]"
                      : ""
                  }
                >
                  Next →
                </GlassButton>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Liquid Glass Player Settings Panel */}
      {settingsOpen && (
        <GlassCard
          variant="regular"
          intensity={5}
          padding="16px"
          radius="22px"
          className="anim-pop border border-white/10"
        >
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Settings2 size={14} className="text-primary" />
              <span>Player Customization</span>
            </h3>
            <span className="text-[11px] text-muted-foreground/80">Liquid Glass Controls</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex items-center justify-between gap-3 text-xs font-medium text-white/90">
              <span className="flex items-center gap-1.5">
                <Sparkles size={14} className="text-cyan-300" />
                <span>Ambient Refraction Glow</span>
              </span>
              <GlassSwitch
                checked={ambientGlow}
                onChange={setAmbientGlow}
                tint="#38bdf8"
                aria-label="Ambient Refraction Glow"
              />
            </label>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs text-white/80">
                <span>Glow Refraction Intensity</span>
                <span className="text-[11px] text-cyan-300 font-semibold">{ambientIntensity}%</span>
              </div>
              <GlassSlider
                value={ambientIntensity}
                onChange={setAmbientIntensity}
                min={10}
                max={100}
                tint="#8b5cf6"
                aria-label="Glow Intensity"
              />
            </div>

            <label className="flex items-center justify-between gap-3 text-xs font-medium text-white/90">
              <span>Autoplay Next Episode</span>
              <GlassSwitch
                checked={autoplayNext}
                onChange={setAutoplayNext}
                tint="#8b5cf6"
                aria-label="Autoplay Next Episode"
              />
            </label>
          </div>
        </GlassCard>
      )}

      {/* Desktop / Full Episode Selector */}
      {a && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Episodes</span>
              <span className="text-xs font-normal text-muted-foreground">
                ({epNum} of {total ?? 12})
              </span>
            </h2>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12">
            {Array.from({ length: total ?? 12 }).map((_, i) => {
              const n = i + 1;
              const active = n === epNum;
              const isWatched = watchedEpisodes.includes(n);
              return (
                <Link
                  key={n}
                  to="/watch/$id/$ep"
                  params={{ id, ep: String(n) }}
                  preload="intent"
                  className={`rounded-xl px-2 py-2 text-center text-xs font-semibold transition active:scale-95 ${
                    active
                      ? "bg-primary text-white shadow-lg shadow-primary/30"
                      : isWatched
                        ? "bg-white/10 text-cyan-200 border border-cyan-400/20"
                        : "glass text-white/80 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <span>{n}</span>
                  {isWatched && !active && (
                    <span className="block text-[9px] text-cyan-400">✓</span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Mobile Episode Drawer Bottom Sheet */}
      <GlassSheet
        open={episodeSheetOpen}
        onClose={() => setEpisodeSheetOpen(false)}
        aria-label="Episodes Sheet"
        detents={["medium", "large"]}
        intensity={6}
      >
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div>
              <h3 className="text-base font-bold text-white">Select Episode</h3>
              <p className="text-xs text-muted-foreground">
                {total ? `${total} Episodes available` : "Episode list"}
              </p>
            </div>
            <GlassButton variant="clear" size="sm" onClick={() => setEpisodeSheetOpen(false)}>
              Done
            </GlassButton>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-[55vh] overflow-y-auto pr-1">
            {Array.from({ length: total ?? 12 }).map((_, i) => {
              const n = i + 1;
              const active = n === epNum;
              const isWatched = watchedEpisodes.includes(n);
              return (
                <button
                  key={n}
                  onClick={() => {
                    setEpisodeSheetOpen(false);
                    goEp(n);
                  }}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl text-xs font-semibold transition active:scale-95 ${
                    active
                      ? "bg-primary text-white shadow-lg shadow-primary/30"
                      : isWatched
                        ? "bg-white/10 text-cyan-200 border border-cyan-400/20"
                        : "bg-white/5 text-white/80 hover:bg-white/10"
                  }`}
                >
                  <span>EP {n}</span>
                  {isWatched && <span className="text-[10px] text-cyan-400">✓ Watched</span>}
                </button>
              );
            })}
          </div>
        </div>
      </GlassSheet>
    </div>
  );
}

function Toggle({
  value,
  options,
  onChange,
}: {
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
}) {
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
