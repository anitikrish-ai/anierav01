import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { jikan } from "@/lib/jikan";
import { AnimeGrid, GridSkeleton } from "@/components/AnimeCard";
import { useState } from "react";

const searchSchema = z.object({
  q: z.string().optional(),
  genre: z.string().optional(),
  year: z.string().optional(),
  status: z.string().optional(),
  type: z.string().optional(),
});

export const Route = createFileRoute("/browse")({
  head: () => ({
    meta: [
      { title: "Browse Anime — Search & Filter | AniEra" },
      { name: "description", content: "Search and filter anime by title, genre, year, type and status. Stream sub or dub on AniEra's frosted-glass player." },
      { property: "og:title", content: "Browse Anime — AniEra" },
      { property: "og:description", content: "Search & filter every anime — by genre, year, status, type." },
      { property: "og:url", content: "https://aniera.lovable.app/browse" },
    ],
    links: [{ rel: "canonical", href: "https://aniera.lovable.app/browse" }],
  }),
  validateSearch: searchSchema,
  component: BrowsePage,
});

function BrowsePage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [year, setYear] = useState(search.year ?? "");
  const [genre, setGenre] = useState(search.genre ?? "");
  const [status, setStatus] = useState(search.status ?? "");
  const [type, setType] = useState(search.type ?? "");

  const genresQ = useQuery({ queryKey: ["genres"], queryFn: () => jikan.genres(), staleTime: 1000 * 60 * 60 });

  const results = useQuery({
    queryKey: ["search", search.q, search.genre, search.year, search.status, search.type],
    queryFn: () => jikan.search(search.q || "", 1, search.genre, search.year, search.status, search.type),
    enabled: Boolean(search.q || search.genre || search.year || search.status || search.type),
  });

  const apply = () => navigate({ search: {
    q: search.q,
    genre: genre || undefined,
    year: year || undefined,
    status: status || undefined,
    type: type || undefined,
  } as any });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-white">
          {search.q ? <>Results for <span className="text-gradient">"{search.q}"</span></> : "Browse Anime"}
        </h1>
      </div>

      <div className="glass flex flex-wrap items-center gap-3 rounded-2xl p-4">
        <select
          value={genre}
          onChange={e => setGenre(e.target.value)}
          className="rounded-lg bg-white/5 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-neon-cyan"
        >
          <option value="">All genres</option>
          {genresQ.data?.data?.slice(0, 40).map(g => (
            <option key={g.mal_id} value={String(g.mal_id)} className="bg-background">{g.name}</option>
          ))}
        </select>
        <select
          value={type}
          onChange={e => setType(e.target.value)}
          className="rounded-lg bg-white/5 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-neon-cyan"
        >
          <option value="">Any type</option>
          {["tv", "movie", "ova", "special", "ona", "music"].map(t => (
            <option key={t} value={t} className="bg-background">{t.toUpperCase()}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="rounded-lg bg-white/5 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-neon-cyan"
        >
          <option value="">Any status</option>
          <option value="airing" className="bg-background">Airing</option>
          <option value="complete" className="bg-background">Completed</option>
          <option value="upcoming" className="bg-background">Upcoming</option>
        </select>
        <input
          type="number"
          placeholder="Year"
          value={year}
          onChange={e => setYear(e.target.value)}
          className="w-28 rounded-lg bg-white/5 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-neon-cyan"
        />
        <button
          onClick={apply}
          className="ml-auto rounded-lg bg-gradient-to-r from-neon-cyan to-neon-magenta px-4 py-2 text-sm font-semibold text-background hover:scale-105 transition"
        >Apply Filters</button>
      </div>

      {results.isLoading ? (
        <GridSkeleton count={18} />
      ) : results.data ? (
        results.data.data.length ? (
          <AnimeGrid items={results.data.data} />
        ) : (
          <p className="text-white/60">No results found.</p>
        )
      ) : (
        <p className="text-white/60">Search for an anime or apply a filter above.</p>
      )}
    </div>
  );
}