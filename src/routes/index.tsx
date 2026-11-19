import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { jikan, bestTitle, type Anime } from "@/lib/jikan";
import { AnimeGrid, GridSkeleton, bestImage } from "@/components/AnimeCard";
import { ErrorState, EmptyState } from "@/components/StateBlocks";
import { getHistory, getEpisodeProgress, type HistoryEntry } from "@/lib/history";
import { Reveal } from "@/components/Reveal";
import { useEffect, useMemo, useState } from "react";
import { GlassButton } from "@zakisheriff/liquid-glass";
import { LiquidTabs } from "@/components/LiquidTabs";
import { QuickViewSheet } from "@/components/QuickViewSheet";
import {
  Play,
  Info,
  Sparkles,
  Compass,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "AniEra — Anime Streaming, Seasonal Anime 2026, Sub & Dub" },
      {
        name: "description",
        content:
          "Stream trending and seasonal anime 2026 on AniEra: top airing series, upcoming episodes, sub & dub playback, watchlist and continue-watching — all in a frosted-glass UI.",
      },
      { property: "og:title", content: "AniEra — Anime Streaming, Seasonal Anime 2026" },
      {
        property: "og:description",
        content: "Trending, seasonal & upcoming anime — sub or dub, in a frosted-glass player.",
      },
      { property: "og:url", content: "https://aniera.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://aniera.lovable.app/" }],
  }),
  component: HomePage,
});

const CATEGORIES = ["All", "Trending", "This Season", "Top Rated", "Upcoming", "Popular"];

function HomePage() {
  const [activeCategory, setActiveCategory] = useState(0);

  const trending = useQuery({
    queryKey: ["top-airing"],
    queryFn: () => jikan.topAiring(1),
    staleTime: 1000 * 60 * 15,
    placeholderData: keepPreviousData,
  });
  const season = useQuery({
    queryKey: ["season-now"],
    queryFn: () => jikan.seasonNow(1),
    staleTime: 1000 * 60 * 15,
    placeholderData: keepPreviousData,
  });
  const popular = useQuery({
    queryKey: ["top-popular"],
    queryFn: () => jikan.topPopular(1),
    staleTime: 1000 * 60 * 15,
    placeholderData: keepPreviousData,
  });
  const rated = useQuery({
    queryKey: ["top-rated"],
    queryFn: () => jikan.topRated(1),
    staleTime: 1000 * 60 * 15,
    placeholderData: keepPreviousData,
  });
  const upcoming = useQuery({
    queryKey: ["season-upcoming"],
    queryFn: () => jikan.seasonUpcoming(1),
    staleTime: 1000 * 60 * 15,
    placeholderData: keepPreviousData,
  });

  const heroPool = useMemo(() => trending.data?.data?.slice(0, 5) ?? [], [trending.data]);

  return (
    <div className="page-enter space-y-8 sm:space-y-12">
      {/* Subtle Welcome Header */}
      <div className="anim-rise flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-primary anim-glow" />
          <p className="truncate text-xs sm:text-sm text-muted-foreground">
            Welcome to <span className="font-semibold text-foreground">AniEra</span> — seasonal
            releases, sub &amp; dub streams in liquid glass.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/browse"
            preload="intent"
            className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 transition"
          >
            <Compass size={13} aria-hidden="true" />
            <span>Catalogue</span>
          </Link>
          <Link
            to="/schedule"
            preload="intent"
            className="inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 transition"
          >
            <CalendarDays size={13} aria-hidden="true" />
            <span>Schedule</span>
          </Link>
        </div>
      </div>

      <HeroCarousel
        pool={heroPool}
        loading={trending.isLoading}
        error={trending.isError ? (trending.error as Error)?.message : undefined}
        onRetry={() => trending.refetch()}
        retrying={trending.isFetching}
      />

      {/* Interactive Category Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2 shrink-0">
          <Sparkles size={16} className="text-primary anim-glow" aria-hidden="true" />
          <span className="text-sm font-semibold tracking-tight text-white">Explore Category</span>
        </div>
        <LiquidTabs
          ariaLabel="Anime categories"
          options={CATEGORIES}
          value={activeCategory}
          onChange={setActiveCategory}
          size="sm"
          wrap
          className="w-fit"
        />
      </div>

      <ContinueWatching />

      {(activeCategory === 0 || activeCategory === 1) && (
        <Section
          title="Trending Now"
          items={trending.data?.data?.slice(5, 17)}
          loading={trending.isLoading}
          error={trending.isError ? (trending.error as Error)?.message : undefined}
          onRetry={() => trending.refetch()}
          retrying={trending.isFetching}
        />
      )}

      {(activeCategory === 0 || activeCategory === 2) && (
        <Section
          title="This Season"
          items={season.data?.data?.slice(0, 12)}
          loading={season.isLoading}
          error={season.isError ? (season.error as Error)?.message : undefined}
          onRetry={() => season.refetch()}
          retrying={season.isFetching}
        />
      )}

      {(activeCategory === 0 || activeCategory === 3) && (
        <Section
          title="Top Rated"
          items={rated.data?.data?.slice(0, 12)}
          loading={rated.isLoading}
          error={rated.isError ? (rated.error as Error)?.message : undefined}
          onRetry={() => rated.refetch()}
          retrying={rated.isFetching}
        />
      )}

      {(activeCategory === 0 || activeCategory === 4) && (
        <Section
          title="Upcoming Next Season"
          items={upcoming.data?.data?.slice(0, 12)}
          loading={upcoming.isLoading}
          error={upcoming.isError ? (upcoming.error as Error)?.message : undefined}
          onRetry={() => upcoming.refetch()}
          retrying={upcoming.isFetching}
        />
      )}

      {(activeCategory === 0 || activeCategory === 5) && (
        <Section
          title="All-Time Popular"
          items={popular.data?.data?.slice(0, 12)}
          loading={popular.isLoading}
          error={popular.isError ? (popular.error as Error)?.message : undefined}
          onRetry={() => popular.refetch()}
          retrying={popular.isFetching}
        />
      )}
    </div>
  );
}

function HeroCarousel({
  pool,
  loading,
  error,
  onRetry,
  retrying,
}: {
  pool: Anime[];
  loading: boolean;
  error?: string;
  onRetry: () => void;
  retrying: boolean;
}) {
  const navigate = useNavigate();
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [previewAnime, setPreviewAnime] = useState<Anime | null>(null);
  const [posterError, setPosterError] = useState(false);

  useEffect(() => {
    if (pool.length < 2 || previewAnime || paused) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % pool.length), 7000);
    return () => clearInterval(t);
  }, [pool.length, previewAnime, paused]);

  const anime = pool.length ? pool[idx % pool.length] : null;
  const img = bestImage(anime);

  useEffect(() => {
    setPosterError(false);
  }, [anime?.mal_id]);

  if (loading) {
    return <div className="h-[360px] sm:h-[420px] rounded-3xl shimmer" />;
  }
  if (error) {
    return <ErrorState message={error} onRetry={onRetry} retrying={retrying} />;
  }
  if (!anime) {
    return <EmptyState title="No featured series right now" hint="Try refreshing in a moment." />;
  }

  return (
    <>
      <section
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        className="on-media relative overflow-hidden rounded-3xl border border-white/12 bg-[#0b0b0e] shadow-2xl min-h-[340px] sm:min-h-[410px]"
      >
        {img && !posterError && (
          <div
            key={`bg-${anime.mal_id}`}
            className="anim-hero-bg absolute inset-0 blur-2xl transition-opacity duration-700"
            style={{
              backgroundImage: `url(${img})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              opacity: 0.42,
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#09090b]/96 via-[#09090b]/78 to-[#09090b]/35 sm:via-[#09090b]/65" />
        <div className="relative grid items-center gap-6 p-5 sm:p-8 lg:p-10 md:grid-cols-[1fr_220px] lg:grid-cols-[1fr_260px] md:gap-8">
          <div key={anime.mal_id} className="flex flex-col justify-center min-w-0">
            <span className="anim-rise mb-2.5 sm:mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 backdrop-blur-md px-3 py-1 text-xs font-semibold text-sky-300">
              <span className="h-1.5 w-1.5 rounded-full bg-primary anim-glow" /> #
              {(idx % pool.length) + 1} Trending Airing
            </span>
            <h1
              className="anim-rise font-display text-2xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl line-clamp-2"
              style={{ animationDelay: "60ms" }}
            >
              {bestTitle(anime)}
            </h1>
            <div
              className="anim-rise mt-3 flex flex-wrap gap-1.5 sm:gap-2 text-xs text-white/80"
              style={{ animationDelay: "110ms" }}
            >
              {anime.score ? (
                <span className="rounded-md border border-amber-400/25 bg-amber-400/15 px-2 py-0.5 font-semibold text-amber-300">
                  ★ {anime.score.toFixed(1)}
                </span>
              ) : null}
              {anime.type ? (
                <span className="rounded-md bg-white/10 px-2 py-0.5">{anime.type}</span>
              ) : null}
              {anime.episodes ? (
                <span className="rounded-md bg-white/10 px-2 py-0.5">{anime.episodes} eps</span>
              ) : null}
              {anime.year ? (
                <span className="rounded-md bg-white/10 px-2 py-0.5">{anime.year}</span>
              ) : null}
            </div>
            <p
              className="anim-rise mt-3 line-clamp-3 max-w-2xl text-xs sm:text-sm text-white/75 leading-relaxed"
              style={{ animationDelay: "160ms" }}
            >
              {anime.synopsis || "Stream episodes subbed or dubbed on AniEra."}
            </p>
            <div
              className="anim-rise mt-5 flex flex-wrap items-center gap-2.5"
              style={{ animationDelay: "210ms" }}
            >
              <GlassButton
                variant="tinted-filled"
                tint="#0a84ff"
                size="md"
                icon={<Play size={15} />}
                onClick={() =>
                  navigate({
                    to: "/watch/$id/$ep",
                    params: { id: String(anime.mal_id), ep: "1" },
                  })
                }
                className="font-semibold"
              >
                Watch Now
              </GlassButton>
              <GlassButton
                variant="glass"
                size="md"
                icon={<Info size={15} />}
                onClick={() => setPreviewAnime(anime)}
              >
                Quick Preview
              </GlassButton>
              <GlassButton
                variant="clear"
                size="md"
                onClick={() =>
                  navigate({
                    to: "/anime/$id",
                    params: { id: String(anime.mal_id) },
                  })
                }
              >
                More Info
              </GlassButton>
            </div>
            {pool.length > 1 && (
              <div className="mt-5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIdx((i) => (i - 1 + pool.length) % pool.length)}
                  aria-label="Previous featured anime"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition"
                >
                  <ChevronLeft size={14} />
                </button>
                <div className="flex items-center gap-1.5">
                  {pool.map((item, i) => (
                    <button
                      key={item.mal_id}
                      type="button"
                      onClick={() => setIdx(i)}
                      aria-label={`Slide ${i + 1}: ${bestTitle(item)}`}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === idx % pool.length
                          ? "w-8 bg-primary"
                          : "w-3 bg-white/30 hover:bg-white/60"
                      }`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setIdx((i) => (i + 1) % pool.length)}
                  aria-label="Next featured anime"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
          <div className="hidden md:block">
            {img && !posterError ? (
              <img
                key={anime.mal_id}
                src={img}
                alt={bestTitle(anime)}
                fetchPriority="high"
                onError={() => setPosterError(true)}
                className="anim-pop aspect-[2/3] w-full rounded-2xl object-cover border border-white/15 shadow-2xl"
              />
            ) : (
              <div className="aspect-[2/3] w-full rounded-2xl bg-white/5 border border-white/10" />
            )}
          </div>
        </div>
      </section>

      <QuickViewSheet
        anime={previewAnime}
        open={!!previewAnime}
        onClose={() => setPreviewAnime(null)}
      />
    </>
  );
}

function Section({
  title,
  items,
  loading,
  error,
  onRetry,
  retrying,
}: {
  title: string;
  items?: Anime[];
  loading: boolean;
  error?: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <section>
      <Reveal variant="slide-left" className="mb-4 flex items-end justify-between">
        <h2 className="font-display text-xl sm:text-2xl font-bold text-white">{title}</h2>
        <span className="h-px flex-1 translate-y-[-6px] bg-gradient-to-r from-primary/40 to-transparent ml-4" />
      </Reveal>
      {loading ? (
        <GridSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} retrying={retrying} />
      ) : !items || items.length === 0 ? (
        <EmptyState title={`No ${title.toLowerCase()} titles`} hint="Check back shortly." />
      ) : (
        <AnimeGrid items={items} />
      )}
    </section>
  );
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const h = Math.floor(m / 60);
  return h > 0
    ? `${h}:${String(m % 60).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

function ContinueWatching() {
  const [items, setItems] = useState<HistoryEntry[]>([]);
  const [progress, setProgress] = useState<Record<string, { t: number; d: number }>>({});
  useEffect(() => {
    const list = getHistory();
    setItems(list);
    const map: Record<string, { t: number; d: number }> = {};
    for (const e of list) {
      const p = getEpisodeProgress(e.malId, e.episode);
      if (p && p.d > 0) map[`${e.malId}:${e.episode}`] = p;
    }
    setProgress(map);
  }, []);
  if (!items.length) return null;
  return (
    <section>
      <Reveal variant="slide-left" className="mb-4 flex items-end justify-between">
        <h2 className="font-display text-xl sm:text-2xl font-bold text-white">Continue Watching</h2>
        <span className="h-px flex-1 translate-y-[-6px] bg-gradient-to-r from-primary/40 to-transparent ml-4" />
      </Reveal>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {items.slice(0, 6).map((e, i) => {
          const p = progress[`${e.malId}:${e.episode}`];
          const pct = p ? Math.min(100, Math.round((p.t / p.d) * 100)) : 0;
          return (
            <Reveal key={e.malId} variant="scale" delay={i * 40}>
              <Link
                to="/watch/$id/$ep"
                params={{ id: String(e.malId), ep: String(e.episode) }}
                preload="intent"
                className="sheen card-lift group relative block overflow-hidden rounded-2xl surface transition active:scale-[0.98]"
              >
                <div className="aspect-[2/3] overflow-hidden bg-white/[0.03]">
                  <img
                    src={e.image}
                    alt={e.title}
                    loading="lazy"
                    onError={(ev) => {
                      (ev.currentTarget as HTMLImageElement).style.opacity = "0";
                    }}
                    className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  />
                </div>
                <div className="on-media pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/65 to-transparent p-3 pt-8">
                  <h3 className="truncate text-sm font-semibold text-white">{e.title}</h3>
                  <p className="text-[11px] text-white/70">
                    Ep {e.episode}
                    {e.totalEpisodes ? ` / ${e.totalEpisodes}` : ""} · {e.lang.toUpperCase()}
                  </p>
                  {p && (
                    <>
                      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/20">
                        <div
                          className="h-full origin-left rounded-full bg-gradient-to-r from-sky-400 to-blue-500 transition-transform duration-700 ease-out"
                          style={{ width: "100%", transform: `scaleX(${pct / 100})` }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-white/60">
                        {pct >= 95 ? "Finished" : `Resume at ${fmtTime(p.t)}`}
                      </p>
                    </>
                  )}
                </div>
              </Link>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
