import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { jikan, bestTitle, type Anime } from "@/lib/jikan";
import { AnimeGrid, GridSkeleton } from "@/components/AnimeCard";
import { getHistory, getEpisodeProgress, type HistoryEntry } from "@/lib/history";
import { Reveal } from "@/components/Reveal";
import { useEffect, useMemo, useState } from "react";
import { GlassButton, GlassSegmented } from "@zakisheriff/liquid-glass";
import { QuickViewSheet } from "@/components/QuickViewSheet";
import { Play, Info, Sparkles, TrendingUp, Calendar, Star, Compass } from "lucide-react";

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
    <div className="space-y-8 sm:space-y-12">
      <HeroCarousel pool={heroPool} loading={trending.isLoading} />

      {/* Liquid Glass Interactive Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-primary" />
          <span className="text-sm font-semibold tracking-tight text-white">Explore Category</span>
        </div>
        <div className="w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <GlassSegmented
            options={CATEGORIES}
            value={activeCategory}
            onChange={setActiveCategory}
            size="sm"
            intensity={4}
            aria-label="Anime categories"
            className="w-full sm:w-auto"
          />
        </div>
      </div>

      <ContinueWatching />

      {(activeCategory === 0 || activeCategory === 1) && (
        <Section
          title="Trending Now"
          items={trending.data?.data?.slice(5, 17)}
          loading={trending.isLoading}
        />
      )}

      {(activeCategory === 0 || activeCategory === 2) && (
        <Section
          title="This Season"
          items={season.data?.data?.slice(0, 12)}
          loading={season.isLoading}
        />
      )}

      {(activeCategory === 0 || activeCategory === 3) && (
        <Section
          title="Top Rated"
          items={rated.data?.data?.slice(0, 12)}
          loading={rated.isLoading}
        />
      )}

      {(activeCategory === 0 || activeCategory === 4) && (
        <Section
          title="Upcoming Next Season"
          items={upcoming.data?.data?.slice(0, 12)}
          loading={upcoming.isLoading}
        />
      )}

      {(activeCategory === 0 || activeCategory === 5) && (
        <Section
          title="All-Time Popular"
          items={popular.data?.data?.slice(0, 12)}
          loading={popular.isLoading}
        />
      )}
    </div>
  );
}

function HeroCarousel({ pool, loading }: { pool: Anime[]; loading: boolean }) {
  const navigate = useNavigate();
  const [idx, setIdx] = useState(0);
  const [previewAnime, setPreviewAnime] = useState<Anime | null>(null);

  useEffect(() => {
    if (pool.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % pool.length), 7000);
    return () => clearInterval(t);
  }, [pool.length]);

  if (loading || !pool.length) {
    return <div className="h-[360px] sm:h-[420px] rounded-3xl shimmer" />;
  }
  const anime = pool[idx % pool.length];
  const img = anime.images.webp?.large_image_url || anime.images.jpg.large_image_url;

  return (
    <>
      <section className="relative overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
        <div
          key={anime.mal_id}
          className="absolute inset-0 scale-110 blur-2xl transition-opacity duration-700"
          style={{
            backgroundImage: `url(${img})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.45,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/75 to-transparent sm:from-background sm:via-background/60" />
        <div className="relative grid gap-6 p-5 sm:p-10 md:grid-cols-[1fr_280px] md:gap-10">
          <div key={anime.mal_id} className="flex flex-col justify-center">
            <span className="anim-rise mb-2 sm:mb-3 inline-flex w-fit items-center gap-2 rounded-full glass px-3 py-1 text-xs font-semibold text-cyan-300">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 glow-cyan anim-glow" /> #
              {idx + 1} Trending Airing
            </span>
            <h1
              className="anim-rise font-display text-2xl font-bold leading-tight text-white sm:text-5xl"
              style={{ animationDelay: "60ms" }}
            >
              {bestTitle(anime)}
            </h1>
            <div
              className="anim-rise mt-2.5 flex flex-wrap gap-1.5 sm:gap-2 text-xs text-white/70"
              style={{ animationDelay: "110ms" }}
            >
              {anime.score && (
                <span className="rounded-md bg-white/10 px-2 py-0.5 font-semibold text-cyan-300">
                  ★ {anime.score.toFixed(1)}
                </span>
              )}
              {anime.type && (
                <span className="rounded-md bg-white/10 px-2 py-0.5">{anime.type}</span>
              )}
              {anime.episodes && (
                <span className="rounded-md bg-white/10 px-2 py-0.5">{anime.episodes} eps</span>
              )}
              {anime.year && (
                <span className="rounded-md bg-white/10 px-2 py-0.5">{anime.year}</span>
              )}
            </div>
            <p
              className="anim-rise mt-3 line-clamp-3 max-w-2xl text-xs sm:text-sm text-white/75 leading-relaxed"
              style={{ animationDelay: "160ms" }}
            >
              {anime.synopsis}
            </p>
            <div
              className="anim-rise mt-5 flex flex-wrap items-center gap-2.5"
              style={{ animationDelay: "210ms" }}
            >
              <GlassButton
                variant="tinted-filled"
                tint="#8b5cf6"
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
              <div className="mt-5 flex gap-1.5">
                {pool.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setIdx(i)}
                    aria-label={`Slide ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all ${
                      i === idx ? "w-8 bg-cyan-400" : "w-3 bg-white/30 hover:bg-white/60"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="hidden md:block">
            <img
              key={anime.mal_id}
              src={img}
              alt={bestTitle(anime)}
              fetchPriority="high"
              className="anim-pop aspect-[2/3] w-full rounded-2xl object-cover glass shadow-2xl"
            />
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

function Section({ title, items, loading }: { title: string; items?: Anime[]; loading: boolean }) {
  return (
    <section>
      <Reveal variant="slide-left" className="mb-4 flex items-end justify-between">
        <h2 className="font-display text-2xl font-bold text-white">{title}</h2>
        <span className="h-px flex-1 translate-y-[-6px] bg-gradient-to-r from-neon-cyan/40 to-transparent ml-4" />
      </Reveal>
      {loading || !items ? <GridSkeleton /> : <AnimeGrid items={items} />}
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
      <h2 className="mb-4 font-display text-2xl font-bold text-white">Continue Watching</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {items.slice(0, 6).map((e, i) => {
          const p = progress[`${e.malId}:${e.episode}`];
          const pct = p ? Math.min(100, Math.round((p.t / p.d) * 100)) : 0;
          return (
            <Reveal key={e.malId} variant="scale" delay={i * 45}>
              <Link
                to="/watch/$id/$ep"
                params={{ id: String(e.malId), ep: String(e.episode) }}
                className="sheen group relative block overflow-hidden rounded-2xl glass transition hover:-translate-y-1.5 hover:glow-cyan"
              >
                <div className="aspect-[2/3] overflow-hidden">
                  <img
                    src={e.image}
                    alt={e.title}
                    className="h-full w-full object-cover transition group-hover:scale-110"
                  />
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-8">
                  <h3 className="truncate text-sm font-semibold text-white">{e.title}</h3>
                  <p className="text-[11px] text-white/70">
                    Ep {e.episode}
                    {e.totalEpisodes ? ` / ${e.totalEpisodes}` : ""} · {e.lang.toUpperCase()}
                  </p>
                  {p && (
                    <>
                      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/20">
                        <div
                          className="h-full origin-left rounded-full bg-gradient-to-r from-neon-cyan to-neon-magenta transition-transform duration-700 ease-out"
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
