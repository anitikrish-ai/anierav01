import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getFavorites, getHistory, type HistoryEntry } from "@/lib/history";
import { jikan } from "@/lib/jikan";
import { AnimeGrid } from "@/components/AnimeCard";

export const Route = createFileRoute("/library")({
  head: () => ({ meta: [{ title: "Your Library — AniEra" }] }),
  component: LibraryPage,
});

function LibraryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [favIds, setFavIds] = useState<number[]>([]);

  useEffect(() => {
    setHistory(getHistory());
    setFavIds(getFavorites());
  }, []);

  const favQueries = useQueries({
    queries: favIds.map(id => ({
      queryKey: ["anime", id],
      queryFn: () => jikan.anime(id),
    })),
  });
  const favs = favQueries.map(q => q.data?.data).filter(Boolean) as any[];

  return (
    <div className="space-y-10">
      <h1 className="font-display text-3xl font-bold text-white">Your Library</h1>

      <section>
        <h2 className="mb-4 font-display text-xl font-bold text-white">Continue Watching</h2>
        {history.length === 0 ? <p className="text-white/60">Nothing yet — start watching something!</p> : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {history.map(e => (
              <Link key={e.malId} to="/watch/$id/$ep" params={{ id: String(e.malId), ep: String(e.episode) }}
                className="group relative block overflow-hidden rounded-2xl glass transition hover:-translate-y-1 hover:glow-cyan">
                <div className="aspect-[2/3] overflow-hidden">
                  <img src={e.image} alt={e.title} className="h-full w-full object-cover transition group-hover:scale-110" />
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-8">
                  <h3 className="truncate text-sm font-semibold text-white">{e.title}</h3>
                  <p className="text-[11px] text-white/70">Ep {e.episode} · {e.lang.toUpperCase()}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 font-display text-xl font-bold text-white">Favorites</h2>
        {favIds.length === 0 ? <p className="text-white/60">No favorites yet.</p> :
          favs.length === 0 ? <p className="text-white/60">Loading…</p> :
          <AnimeGrid items={favs} />}
      </section>
    </div>
  );
}