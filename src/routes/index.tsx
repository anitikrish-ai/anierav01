import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { jikan, bestTitle, type Anime } from "@/lib/jikan";
import { AnimeGrid, GridSkeleton } from "@/components/AnimeCard";
import { getHistory, getEpisodeProgress, type HistoryEntry } from "@/lib/history";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AniEra — Anime Streaming, Seasonal Anime 2026, Sub & Dub" },
      { name: "description", content: "Stream trending and seasonal anime 2026 on AniEra: top airing series, upcoming episodes, sub & dub playback, watchlist and continue-watching — all in a frosted-glass UI." },
      { property: "og:title", content: "AniEra — Anime Streaming, Seasonal Anime 2026" },
      { property: "og:description", content: "Trending, seasonal & upcoming anime — sub or dub, in a frosted-glass player." },
      { property: "og:url", content: "https://aniera.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://aniera.lovable.app/" }],
  }),
  component: HomePage,
});

function HomePage() {
  const trending = useQuery({ queryKey: ["top-airing"], queryFn: () => jikan.topAiring(1) });
  const season = useQuery({ queryKey: ["season-now"], queryFn: () => jikan.seasonNow(1) });
  const popular = useQuery({ queryKey: ["top-popular"], queryFn: () => jikan.topPopular(1) });
  const rated = useQuery({ queryKey: ["top-rated"], queryFn: () => jikan.topRated(1) });
  const upcoming = useQuery({ queryKey: ["season-upcoming"], queryFn: () => jikan.seasonUpcoming(1) });

  const heroPool = useMemo(() => trending.data?.data?.slice(0, 5) ?? [], [trending.data]);

  return (
    <div className="space-y-12">
      <HeroCarousel pool={heroPool} loading={trending.isLoading} />
      <ContinueWatching />
      <Section title="Trending Now" items={trending.data?.data?.slice(5, 17)} loading={trending.isLoading} />
      <Section title="This Season" items={season.data?.data?.slice(0, 12)} loading={season.isLoading} />
      <Section title="Top Rated" items={rated.data?.data?.slice(0, 12)} loading={rated.isLoading} />
      <Section title="Upcoming Next Season" items={upcoming.data?.data?.slice(0, 12)} loading={upcoming.isLoading} />
      <Section title="All-Time Popular" items={popular.data?.data?.slice(0, 12)} loading={popular.isLoading} />
    </div>
  );
}

function HeroCarousel({ pool, loading }: { pool: Anime[]; loading: boolean }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (pool.length < 2) return;
    const t = setInterval(() => setIdx(i => (i + 1) % pool.length), 7000);
    return () => clearInterval(t);
  }, [pool.length]);
  if (loading || !pool.length) {
    return <div className="h-[420px] rounded-3xl shimmer" />;
  }
  const anime = pool[idx % pool.length];
  const img = anime.images.webp?.large_image_url || anime.images.jpg.large_image_url;
  return (
    <section className="relative overflow-hidden rounded-3xl">
      <div
        key={anime.mal_id}
        className="absolute inset-0 scale-110 blur-2xl transition-opacity duration-700"
        style={{ backgroundImage: `url(${img})`, backgroundSize: "cover", backgroundPosition: "center", opacity: 0.45 }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent" />
      <div className="relative grid gap-6 p-6 sm:p-10 md:grid-cols-[1fr_280px] md:gap-10">
        <div className="flex flex-col justify-center">
          <span className="mb-3 inline-flex w-fit items-center gap-2 rounded-full glass px-3 py-1 text-xs font-medium text-neon-cyan">
            <span className="h-1.5 w-1.5 rounded-full bg-neon-cyan glow-cyan" /> #{idx + 1} Trending
          </span>
          <h1 className="font-display text-3xl font-bold leading-tight text-white sm:text-5xl">
            {bestTitle(anime)}
          </h1>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/70">
            {anime.score && <span className="rounded-md bg-white/10 px-2 py-1">★ {anime.score.toFixed(1)}</span>}
            {anime.type && <span className="rounded-md bg-white/10 px-2 py-1">{anime.type}</span>}
            {anime.episodes && <span className="rounded-md bg-white/10 px-2 py-1">{anime.episodes} eps</span>}
            {anime.year && <span className="rounded-md bg-white/10 px-2 py-1">{anime.year}</span>}
          </div>
          <p className="mt-4 line-clamp-3 max-w-2xl text-sm text-white/70 sm:text-base">
            {anime.synopsis}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/watch/$id/$ep"
              params={{ id: String(anime.mal_id), ep: "1" }}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-neon-cyan to-neon-magenta px-6 py-2.5 text-sm font-semibold text-background transition hover:scale-105 glow-magenta"
            >
              ▶ Watch Now
            </Link>
            <Link
              to="/anime/$id"
              params={{ id: String(anime.mal_id) }}
              className="inline-flex items-center gap-2 rounded-full glass px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              More Info
            </Link>
          </div>
          {pool.length > 1 && (
            <div className="mt-6 flex gap-1.5">
              {pool.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  aria-label={`Slide ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${i === idx ? "w-8 bg-neon-cyan" : "w-3 bg-white/30 hover:bg-white/60"}`}
                />
              ))}
            </div>
          )}
        </div>
        <div className="hidden md:block">
          <img src={img} alt={bestTitle(anime)} className="aspect-[2/3] w-full rounded-2xl object-cover glass" />
        </div>
      </div>
    </section>
  );
}

function Section({ title, items, loading }: { title: string; items?: Anime[]; loading: boolean }) {
  return (
    <section>
      <div className="mb-4 flex items-end justify-between">
        <h2 className="font-display text-2xl font-bold text-white">{title}</h2>
      </div>
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
        {items.slice(0, 6).map(e => {
          const p = progress[`${e.malId}:${e.episode}`];
          const pct = p ? Math.min(100, Math.round((p.t / p.d) * 100)) : 0;
          return (
            <Link
              key={e.malId}
              to="/watch/$id/$ep"
              params={{ id: String(e.malId), ep: String(e.episode) }}
              className="group relative block overflow-hidden rounded-2xl glass transition hover:-translate-y-1 hover:glow-cyan"
            >
              <div className="aspect-[2/3] overflow-hidden">
                <img src={e.image} alt={e.title} className="h-full w-full object-cover transition group-hover:scale-110" />
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-8">
                <h3 className="truncate text-sm font-semibold text-white">{e.title}</h3>
                <p className="text-[11px] text-white/70">Ep {e.episode}{e.totalEpisodes ? ` / ${e.totalEpisodes}` : ""} · {e.lang.toUpperCase()}</p>
                {p && (
                  <>
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/20">
                      <div className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-neon-magenta" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1 text-[10px] text-white/60">
                      {pct >= 95 ? "Finished" : `Resume at ${fmtTime(p.t)}`}
                    </p>
                  </>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
