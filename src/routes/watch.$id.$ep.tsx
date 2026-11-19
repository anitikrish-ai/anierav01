import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { jikan, bestTitle } from "@/lib/jikan";
import { bestImage } from "@/components/AnimeCard";
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
  GlassSwitch,
  GlassSlider,
  GlassCard,
} from "@zakisheriff/liquid-glass";
import { List, Settings2, Sparkles, Share2, Check, X } from "lucide-react";

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
  const validParams = Number.isInteger(malId) && malId > 0 && Number.isInteger(epNum) && epNum >= 1;

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
  const resume = useMemo(
    () => (validParams ? (getEpisodeProgress(malId, epNum)?.t ?? 0) : 0),
    [malId, epNum, validParams],
  );

  const animeQ = useQuery({
    queryKey: ["anime", malId],
    queryFn: () => jikan.anime(malId),
    enabled: validParams,
  });
  const a = animeQ.data?.data;
  const total = a?.episodes ?? null;
  const title = a ? bestTitle(a) : "";

  // MAL → AniList mapping (cached). Drives AniList-keyed embed servers.
  const anilistQ = useQuery({
    queryKey: ["anilist", malId],
    queryFn: () => malToAnilist(malId),
    enabled: validParams,
    staleTime: Infinity,
  });

  // Anikoto title search → series payload (server-side, rate-limit safe).
  const anikotoSearchQ = useQuery({
    queryKey: ["anikoto-search", title],
    queryFn: () => searchAnikotoByTitle({ data: { title } }),
    enabled: validParams && !!title,
    staleTime: 1000 * 60 * 60,
  });
  const anikotoSeriesQ = useQuery({
    queryKey: ["anikoto-series", anikotoSearchQ.data?.id],
    queryFn: () => getAnikotoSeries({ data: { id: String(anikotoSearchQ.data!.id) } }),
    enabled: validParams && !!anikotoSearchQ.data?.id,
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

  // Resolve current server's embed, skipping forward if this server can't serve this request.
  const { embed, activeServer } = useMemo(() => {
    for (let i = 0; i < SERVERS.length; i++) {
      const idx = (serverIdx + i) % SERVERS.length;
      const url = SERVERS[idx].build(ctx);
      if (url) return { embed: url, activeServer: SERVERS[idx] };
    }
    return { embed: null as string | null, activeServer: SERVERS[0] };
  }, [serverIdx, ctx]);

  // HiAnime direct sources — only fetched when HiAnime Direct is active and title (if available) has settled.
  const hianimeQ = useQuery({
    queryKey: ["hianime-src", malId, title, epNum, lang],
    queryFn: () => getHianimeSources({ data: { malId, title, ep: epNum, lang } }),
    enabled:
      validParams && activeServer.id === "hianime-direct" && (!animeQ.isLoading || animeQ.isError),
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  // Reset load watcher whenever the iframe embed changes; auto-flag stalled after 12s (iframe embeds only).
  useEffect(() => {
    setLoadState("loading");
    if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    if (!embed || activeServer.id === "hianime-direct") return;
    stallTimerRef.current = setTimeout(() => {
      setLoadState((prev) => (prev === "loading" ? "stalled" : prev));
    }, 12000);
    return () => {
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    };
  }, [embed, activeServer.id, iframeKey]);

  const tryNextServer = () => {
    setServerIdx((i) => {
      const next = (i + 1) % SERVERS.length;
      setPreferredProvider(malId, SERVERS[next].id);
      return next;
    });
    setIframeKey((k) => k + 1);
  };

  const selectServer = (serverId: string) => {
    const idx = SERVERS.findIndex((s) => s.id === serverId);
    if (idx >= 0) {
      setServerIdx(idx);
      setPreferredProvider(malId, serverId);
      setIframeKey((k) => k + 1);
    }
  };

  const selectLang = (v: Lang) => {
    setLang(v);
    setPreferredLang(v);
  };

  const [watchedEpisodes, setWatchedEpisodes] = useState<number[]>(() =>
    validParams ? getWatchedEpisodes(malId) : [],
  );

  useEffect(() => {
    if (!validParams || !a) return;
    saveHistory({
      malId,
      title: bestTitle(a),
      image: bestImage(a),
      episode: epNum,
      totalEpisodes: total,
      lang,
      updatedAt: Date.now(),
    });
    markEpisodeWatched(malId, epNum);
    setWatchedEpisodes(getWatchedEpisodes(malId));
  }, [a, malId, epNum, lang, total, validParams]);

  const [episodeSheetOpen, setEpisodeSheetOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ambientGlow, setAmbientGlow] = useState(true);
  const [ambientIntensity, setAmbientIntensity] = useState(55);
  const [autoplayNext, setAutoplayNext] = useState(true);
  const [copied, setCopied] = useState(false);

  const totalEpisodesCount = Math.max(
    total ?? 0,
    epNum,
    anikotoSeriesQ.data?.episodes.length ?? 0,
    12,
  );
  const pageSize = 100;
  const totalRanges = Math.ceil(totalEpisodesCount / pageSize);
  const [epRange, setEpRange] = useState(() => Math.floor((epNum - 1) / pageSize));

  useEffect(() => {
    setEpRange(Math.floor((epNum - 1) / pageSize));
  }, [epNum]);

  // Escape key & scroll lock for mobile episode drawer
  useEffect(() => {
    if (!episodeSheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEpisodeSheetOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [episodeSheetOpen]);

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

  if (!validParams) {
    return (
      <div className="py-20 text-center space-y-4">
        <h2 className="text-2xl font-bold text-white">Invalid episode link</h2>
        <p className="text-sm text-white/60 max-w-md mx-auto">
          The anime or episode parameter is missing or malformed.
        </p>
        <Link
          to="/"
          className="inline-flex items-center rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  const rangeStart = epRange * pageSize + 1;
  const rangeEnd = Math.min((epRange + 1) * pageSize, totalEpisodesCount);
  const rangeCount = Math.max(0, rangeEnd - rangeStart + 1);

  return (
    <div className="page-enter space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-white/70">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <Link to="/" className="hover:text-white transition-colors">
            Home
          </Link>
          <span>/</span>
          {a ? (
            <Link
              to="/anime/$id"
              params={{ id }}
              className="truncate max-w-[200px] sm:max-w-xs hover:text-white transition-colors"
            >
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
        {/* Dynamic subtle optical ambient behind the player */}
        {ambientGlow && (
          <div
            className="pointer-events-none absolute -inset-4 sm:-inset-6 rounded-3xl blur-3xl transition-opacity duration-300 -z-10"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(10, 132, 255, 0.24), rgba(255, 255, 255, 0.08), transparent 72%)",
              opacity: ambientIntensity / 100,
            }}
          />
        )}

        <div className="overflow-hidden rounded-3xl glass-strong border border-white/12 shadow-2xl">
          <div className="relative aspect-video w-full bg-black">
            {activeServer.id === "hianime-direct" ? (
              hianimeQ.isLoading || (animeQ.isLoading && !animeQ.isError) ? (
                <div className="flex h-full w-full items-center justify-center text-sm text-white/60">
                  Resolving HiAnime stream…
                </div>
              ) : hianimeQ.data?.sources?.[0]?.file ? (
                <HlsPlayer
                  key={`${hianimeQ.data.sources[0].file}-${iframeKey}`}
                  src={hianimeQ.data.sources[0].file}
                  tracks={hianimeQ.data.tracks}
                  poster={bestImage(a) || undefined}
                  startTime={resume}
                  onReady={() => setLoadState("ok")}
                  onFatalError={() => setLoadState("stalled")}
                  onTryNextServer={tryNextServer}
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
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-4 text-center text-sm text-white/70">
                  <span>
                    {hianimeQ.isError
                      ? "HiAnime direct stream failed to respond."
                      : "HiAnime direct stream not found for this episode."}
                  </span>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => hianimeQ.refetch()}
                      className="rounded-lg bg-white/15 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-white/25"
                    >
                      Retry
                    </button>
                    <button
                      type="button"
                      onClick={tryNextServer}
                      className="rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-primary/90"
                    >
                      Try next server →
                    </button>
                  </div>
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
                className="h-full w-full border-0"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-white/60">
                No server available for this episode.
              </div>
            )}
            {activeServer.id !== "hianime-direct" && loadState === "stalled" && (
              <div className="on-media absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-2 bg-black/75 px-4 py-2.5 text-xs text-white/90 backdrop-blur">
                <span>
                  Stream slow or unavailable on <b>{activeServer.label}</b>.
                </span>
                <button
                  type="button"
                  onClick={tryNextServer}
                  className="rounded-lg bg-primary px-3 py-1 font-semibold text-white hover:bg-primary/90"
                >
                  Try next server →
                </button>
              </div>
            )}
          </div>

          {/* Interactive Player Controls Row */}
          <div className="grid gap-3 p-3.5 sm:p-4 lg:flex lg:flex-wrap lg:items-center lg:justify-between border-t border-white/10">
            <div className="min-w-0">
              <h1 className="truncate text-base sm:text-lg font-bold text-white">
                {a ? bestTitle(a) : "Loading…"} <span className="text-sky-400">· EP {epNum}</span>
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
                tint="#0a84ff"
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
                aria-label="Select streaming server"
                className="min-h-[34px] w-full sm:w-auto max-w-full rounded-xl bg-white/5 px-2.5 py-1.5 text-xs text-white outline-none ring-1 ring-white/10 focus:ring-primary"
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
                tint={settingsOpen ? "#0a84ff" : undefined}
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

              <GlassButton
                variant="filled"
                tint="#0a84ff"
                size="sm"
                onClick={() => goEp(epNum + 1)}
                disabled={!!total && epNum >= total}
                className={showNextHint ? "ring-2 ring-primary/80" : ""}
              >
                {showNextHint ? "Play Next Ep →" : "Next →"}
              </GlassButton>
            </div>
          </div>
          {showNextHint && (
            <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-sky-300">
              <span>Episode finished — ready to continue to Episode {epNum + 1}.</span>
              <button
                type="button"
                onClick={() => goEp(epNum + 1)}
                className="rounded-lg bg-primary px-3 py-1 font-semibold text-white hover:bg-primary/90"
              >
                Next Episode →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Liquid Glass Player Settings Panel */}
      {settingsOpen && (
        <GlassCard
          variant="regular"
          intensity={5}
          padding="16px"
          radius="22px"
          className="anim-pop border border-white/12"
        >
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Settings2 size={14} className="text-primary" />
              <span>Player Customization</span>
            </h3>
            <span className="text-[11px] text-muted-foreground/80">Player Controls</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex items-center justify-between gap-3 text-xs font-medium text-white/90">
              <span className="flex items-center gap-1.5">
                <Sparkles size={14} className="text-sky-400" />
                <span>Ambient Optical Backdrop</span>
              </span>
              <GlassSwitch
                checked={ambientGlow}
                onChange={setAmbientGlow}
                tint="#0a84ff"
                aria-label="Ambient Optical Backdrop"
              />
            </label>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs text-white/80">
                <span>Backdrop Intensity</span>
                <span className="text-[11px] text-sky-400 font-semibold">{ambientIntensity}%</span>
              </div>
              <GlassSlider
                value={ambientIntensity}
                onChange={setAmbientIntensity}
                min={10}
                max={100}
                tint="#0a84ff"
                aria-label="Backdrop Intensity"
              />
            </div>

            <label className="flex items-center justify-between gap-3 text-xs font-medium text-white/90">
              <span>Autoplay Next Episode</span>
              <GlassSwitch
                checked={autoplayNext}
                onChange={setAutoplayNext}
                tint="#0a84ff"
                aria-label="Autoplay Next Episode"
              />
            </label>
          </div>
        </GlassCard>
      )}

      {/* Episode Selector */}
      {a && (
        <section>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Episodes</span>
              <span className="text-xs font-normal text-muted-foreground">
                ({epNum} of {total ?? totalEpisodesCount})
              </span>
            </h2>
            {totalRanges > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: totalRanges }).map((_, idx) => {
                  const start = idx * pageSize + 1;
                  const end = Math.min((idx + 1) * pageSize, totalEpisodesCount);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setEpRange(idx)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                        epRange === idx
                          ? "bg-primary text-white"
                          : "glass text-white/70 hover:text-white"
                      }`}
                    >
                      {start}–{end}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12">
            {Array.from({ length: rangeCount }).map((_, i) => {
              const n = rangeStart + i;
              const active = n === epNum;
              const isWatched = watchedEpisodes.includes(n);
              return (
                <Link
                  key={n}
                  to="/watch/$id/$ep"
                  params={{ id, ep: String(n) }}
                  preload="intent"
                  className={`flex min-h-[42px] flex-col items-center justify-center rounded-xl px-2 py-2 text-center text-xs font-semibold transition active:scale-95 ${
                    active
                      ? "bg-primary !text-white shadow-sm"
                      : isWatched
                        ? "bg-white/10 text-sky-300 border border-primary/30"
                        : "surface text-white/80 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <span>{n}</span>
                  {isWatched && !active && <span className="block text-[9px] text-sky-400">✓</span>}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Smooth 120fps Mobile Episode Drawer Bottom Sheet */}
      {episodeSheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Select Episode"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-md anim-fade"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEpisodeSheetOpen(false);
          }}
        >
          <div
            className="on-media w-full max-w-lg max-h-[82vh] overflow-y-auto no-scrollbar rounded-t-[28px] bg-[#111114]/96 border-t border-white/15 backdrop-blur-3xl p-4 pb-6 space-y-3 text-white anim-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 rounded-full bg-white/20 mx-auto mb-1" />
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div>
                <h3 className="text-base font-bold text-white">Select Episode</h3>
                <p className="text-xs text-white/60">
                  {total ? `${total} Episodes available` : "Episode list"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEpisodeSheetOpen(false)}
                aria-label="Close episode drawer"
                className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>
            {totalRanges > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: totalRanges }).map((_, idx) => {
                  const start = idx * pageSize + 1;
                  const end = Math.min((idx + 1) * pageSize, totalEpisodesCount);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setEpRange(idx)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                        epRange === idx ? "bg-primary text-white" : "bg-white/10 text-white/70"
                      }`}
                    >
                      {start}–{end}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-[55vh] overflow-y-auto pr-1 no-scrollbar">
              {Array.from({ length: rangeCount }).map((_, i) => {
                const n = rangeStart + i;
                const active = n === epNum;
                const isWatched = watchedEpisodes.includes(n);
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setEpisodeSheetOpen(false);
                      goEp(n);
                    }}
                    className={`flex flex-col items-center justify-center p-2.5 min-h-[44px] rounded-xl text-xs font-semibold transition active:scale-95 ${
                      active
                        ? "bg-primary text-white shadow-sm"
                        : isWatched
                          ? "bg-white/10 text-sky-300 border border-primary/30"
                          : "bg-white/5 text-white/80 hover:bg-white/10"
                    }`}
                  >
                    <span>EP {n}</span>
                    {isWatched && <span className="text-[10px] text-sky-400">✓ Watched</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
