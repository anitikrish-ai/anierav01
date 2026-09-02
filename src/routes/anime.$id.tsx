import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { jikan, bestTitle } from "@/lib/jikan";
import { AnimeGrid, GridSkeleton } from "@/components/AnimeCard";
import { useEffect, useState } from "react";
import { getFavorites, toggleFavorite, getWatchedEpisodes } from "@/lib/history";
import { AiringCountdown } from "@/components/AiringCountdown";
import { Reviews } from "@/components/Reviews";


export const Route = createFileRoute("/anime/$id")({
  head: ({ params }) => {
    const url = `https://aniera.lovable.app/anime/${params.id}`;
    return {
      meta: [
        { title: `Anime #${params.id} — Watch on AniEra` },
        { name: "description", content: `Stream this anime on AniEra with sub & dub playback, full episode list, and frosted-glass UI.` },
        { property: "og:title", content: `Watch on AniEra` },
        { property: "og:description", content: `Stream this anime — sub or dub, full episode tracker.` },
        { property: "og:type", content: "video.tv_show" },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: AnimePage,
});

function AnimePage() {
  const { id } = Route.useParams();
  const malId = Number(id);
  const animeQ = useQuery({ queryKey: ["anime", malId], queryFn: () => jikan.anime(malId) });
  const epsQ = useQuery({ queryKey: ["episodes", malId], queryFn: () => jikan.episodes(malId), enabled: !!animeQ.data });
  const recQ = useQuery({ queryKey: ["rec", malId], queryFn: () => jikan.recommendations(malId), enabled: !!animeQ.data });
  const relQ = useQuery({ queryKey: ["rel", malId], queryFn: () => jikan.relations(malId), enabled: !!animeQ.data });

  const [fav, setFav] = useState(false);
  useEffect(() => { setFav(getFavorites().includes(malId)); }, [malId]);
  const [watched, setWatched] = useState<Set<number>>(new Set());
  useEffect(() => { setWatched(new Set(getWatchedEpisodes(malId))); }, [malId]);

  if (animeQ.isLoading || !animeQ.data) return <div className="h-96 rounded-3xl shimmer" />;
  const a = animeQ.data.data;
  const img = a.images.webp?.large_image_url || a.images.jpg.large_image_url;
  const eps = epsQ.data?.data ?? [];
  const totalEps = a.episodes ?? eps.length;
  const episodeList = totalEps && eps.length === 0
    ? Array.from({ length: Math.min(totalEps, 24) }).map((_, i) => ({ mal_id: i + 1, title: `Episode ${i + 1}` }))
    : eps;

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl">
        <div className="absolute inset-0 scale-110 blur-2xl" style={{ backgroundImage: `url(${img})`, backgroundSize: "cover", opacity: 0.45 }} />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/30" />
        <div className="relative grid gap-6 p-6 sm:p-10 md:grid-cols-[240px_1fr]">
          <img src={img} alt={bestTitle(a)} className="aspect-[2/3] w-full max-w-[240px] rounded-2xl object-cover glass" />
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">{bestTitle(a)}</h1>
            {a.title_japanese && <p className="mt-1 text-sm text-white/60">{a.title_japanese}</p>}
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/80">
              {a.score && <span className="rounded-md bg-white/10 px-2 py-1">★ {a.score.toFixed(1)}</span>}
              {a.type && <span className="rounded-md bg-white/10 px-2 py-1">{a.type}</span>}
              {a.episodes && <span className="rounded-md bg-white/10 px-2 py-1">{a.episodes} eps</span>}
              {a.status && <span className="rounded-md bg-white/10 px-2 py-1">{a.status}</span>}
              {a.year && <span className="rounded-md bg-white/10 px-2 py-1">{a.year}</span>}
              {a.duration && <span className="rounded-md bg-white/10 px-2 py-1">{a.duration}</span>}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {a.genres.map(g => (
                <Link key={g.mal_id} to="/browse" search={{ genre: String(g.mal_id) } as any}
                  className="rounded-full glass px-3 py-1 text-xs text-white/80 hover:text-white">
                  {g.name}
                </Link>
              ))}
            </div>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/80">{a.synopsis}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/watch/$id/$ep" params={{ id: String(a.mal_id), ep: "1" }}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-neon-cyan to-neon-magenta px-6 py-2.5 text-sm font-semibold text-background transition hover:scale-105 glow-magenta">
                ▶ Watch Episode 1
              </Link>
              <button
                onClick={() => setFav(toggleFavorite(malId))}
                className={`inline-flex items-center gap-2 rounded-full glass px-6 py-2.5 text-sm font-semibold transition hover:bg-white/10 ${fav ? "text-neon-magenta" : "text-white"}`}
              >
                {fav ? "♥ In Favorites" : "♡ Add to Favorites"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-4 font-display text-2xl font-bold text-white">Episodes</h2>
        {episodeList.length === 0 ? (
          <p className="text-white/60">No episode data available.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {episodeList.slice(0, 100).map((ep, i) => (
              <Link key={ep.mal_id ?? i}
                to="/watch/$id/$ep" params={{ id: String(a.mal_id), ep: String(i + 1) }}
                className={`glass rounded-xl p-3 text-sm transition hover:bg-white/10 hover:text-white ${
                  watched.has(i + 1) ? "ring-1 ring-neon-cyan/40 text-white" : "text-white/85"
                }`}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neon-cyan">EP {i + 1}</span>
                  {watched.has(i + 1) && <span className="text-neon-cyan" title="Watched">✓</span>}
                </div>
                <div className="mt-1 line-clamp-2 text-[13px]">{ep.title || `Episode ${i + 1}`}</div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {recQ.data?.data?.length ? (
        <section>
          <h2 className="mb-4 font-display text-2xl font-bold text-white">You Might Also Like</h2>
          {recQ.isLoading ? <GridSkeleton /> : (
            <AnimeGrid items={recQ.data.data.slice(0, 12).map((r: any) => r.entry)} />
          )}
        </section>
      ) : null}
    </div>
  );
}