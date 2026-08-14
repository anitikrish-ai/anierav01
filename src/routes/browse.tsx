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
  const [q, setQ] = useState(search.q ?? "");
  const [year, setYear] = useState(search.year ?? "");
  const [genre, setGenre] = useState(search.genre ?? "");
  const [status, setStatus] = useState(search.status ?? "");
  const [type, setType] = useState(search.type ?? "");

  // Keep local inputs in sync when the URL changes (navbar search, back button).
  useEffect(() => {
    setQ(search.q ?? "");
    setGenre(search.genre ?? "");
    setYear(search.year ?? "");
    setStatus(search.status ?? "");
    setType(search.type ?? "");
  }, [search.q, search.genre, search.year, search.status, search.type]);

  const genresQ = useQuery({
    queryKey: ["genres"],
    queryFn: () => jikan.genres(),
    staleTime: 1000 * 60 * 60,
  });

  const hasFilter = Boolean(
    search.q || search.genre || search.year || search.status || search.type,
  );

  const results = useQuery({
    queryKey: ["search", search.q, search.genre, search.year, search.status, search.type],
    queryFn: () =>
      jikan.search(search.q || "", 1, search.genre, search.year, search.status, search.type),
    enabled: hasFilter,
  });

  const apply = () =>
    navigate({
      search: {
        q: q.trim() || undefined,
        genre: genre || undefined,
        year: year || undefined,
        status: status || undefined,
        type: type || undefined,
      },
    });

  const reset = () => navigate({ search: {} });

  const items = Array.isArray(results.data?.data) ? results.data.data : [];

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-white">
          {search.q ? (
            <>
              Results for <span className="text-gradient">"{search.q}"</span>
            </>
          ) : (
            "Browse Anime"
          )}
        </h1>
        <p className="mt-1 text-sm text-white/60">
          Search the full catalogue, or narrow it down by genre, type, status and year.
        </p>
      </div>

      <form
        onSubmit={e => {
          e.preventDefault();
          apply();
        }}
        className="glass flex flex-wrap items-center gap-3 rounded-2xl p-4"
      >
        <input
          type="search"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search anime titles…"
          aria-label="Search anime"
          className="min-w-[200px] flex-1 rounded-lg bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none ring-1 ring-white/10 focus:ring-neon-cyan"
        />
        <select
          value={genre}
          onChange={e => setGenre(e.target.value)}
          aria-label="Genre"
          className="rounded-lg bg-white/5 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-neon-cyan"
        >
          <option value="">All genres</option>
          {genresQ.data?.data?.slice(0, 40).map(g => (
            <option key={g.mal_id} value={String(g.mal_id)} className="bg-background">
              {g.name}
            </option>
          ))}
        </select>
        <select
          value={type}
          onChange={e => setType(e.target.value)}
          aria-label="Type"
          className="rounded-lg bg-white/5 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-neon-cyan"
        >
          <option value="">Any type</option>
          {["tv", "movie", "ova", "special", "ona", "music"].map(t => (
            <option key={t} value={t} className="bg-background">
              {t.toUpperCase()}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          aria-label="Status"
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
          aria-label="Year"
          value={year}
          onChange={e => setYear(e.target.value)}
          className="w-28 rounded-lg bg-white/5 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-neon-cyan"
        />
        {hasFilter && (
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-white/5 px-4 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white"
          >
            Reset
          </button>
        )}
        <button
          type="submit"
          className="ml-auto rounded-lg bg-gradient-to-r from-neon-cyan to-neon-magenta px-4 py-2 text-sm font-semibold text-background transition hover:scale-105"
        >
          Apply Filters
        </button>
      </form>

      {!hasFilter ? (
        <EmptyState
          title="Start exploring"
          hint="Type a title or pick a genre, type, status or year above to see results."
        />
      ) : results.isLoading ? (
        <GridSkeleton count={18} />
      ) : results.isError ? (
        <ErrorState
          message={(results.error as Error)?.message}
          onRetry={() => results.refetch()}
          retrying={results.isFetching}
        />
      ) : items.length ? (
        <AnimeGrid items={items} />
      ) : (
        <EmptyState
          title="No results found"
          hint="Try a different spelling, or loosen the filters."
        />
      )}
    </div>
  );
}
