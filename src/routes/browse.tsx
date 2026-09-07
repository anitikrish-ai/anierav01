import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { jikan } from "@/lib/jikan";
import { AnimeGrid, GridSkeleton } from "@/components/AnimeCard";
import { ErrorState, EmptyState } from "@/components/StateBlocks";
import { useEffect, useState } from "react";

/** URL values may arrive as numbers (e.g. ?genre=1) — coerce everything safely. */
const str = z
  .union([z.string(), z.number()])
  .optional()
  .transform(v => (v === undefined || v === "" ? undefined : String(v)));

const searchSchema = z.object({
  q: str,
  genre: str,
  year: str,
  status: str,
  type: str,
  minScore: str,
  order: str,
  page: z
    .union([z.string(), z.number()])
    .optional()
    .transform(v => {
      const n = typeof v === "string" ? parseInt(v, 10) : v;
      return n && Number.isFinite(n) && n > 0 ? n : undefined;
    }),
});

export const Route = createFileRoute("/browse")({
  head: () => ({
    meta: [
      { title: "Browse Anime — Search & Filter | AniEra" },
      { name: "description", content: "Search and filter anime by title, genre, year, type, score and status. Stream sub or dub on AniEra's frosted-glass player." },
      { property: "og:title", content: "Browse Anime — AniEra" },
      { property: "og:description", content: "Search & filter every anime — by genre, year, status, type and rating." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://aniera.lovable.app/browse" },
    ],
    links: [{ rel: "canonical", href: "https://aniera.lovable.app/browse" }],
  }),
  validateSearch: searchSchema,
  component: BrowsePage,
});

const ORDERS = [
  { v: "", label: "Best match" },
  { v: "popularity", label: "Most popular" },
  { v: "score", label: "Highest rated" },
  { v: "start_date", label: "Newest" },
  { v: "title", label: "A → Z" },
];

function BrowsePage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [q, setQ] = useState(search.q ?? "");
  const [year, setYear] = useState(search.year ?? "");
  const [genre, setGenre] = useState(search.genre ?? "");
  const [status, setStatus] = useState(search.status ?? "");
  const [type, setType] = useState(search.type ?? "");
  const [minScore, setMinScore] = useState(search.minScore ?? "");
  const [order, setOrder] = useState(search.order ?? "");

  // Keep local inputs in sync when the URL changes (navbar search, back button).
  useEffect(() => {
    setQ(search.q ?? "");
    setGenre(search.genre ?? "");
    setYear(search.year ?? "");
    setStatus(search.status ?? "");
    setType(search.type ?? "");
    setMinScore(search.minScore ?? "");
    setOrder(search.order ?? "");
  }, [search.q, search.genre, search.year, search.status, search.type, search.minScore, search.order]);

  const genresQ = useQuery({
    queryKey: ["genres"],
    queryFn: () => jikan.genres(),
    staleTime: 1000 * 60 * 60 * 6,
  });

  const page = search.page ?? 1;

  const hasFilter = Boolean(
    search.q || search.genre || search.year || search.status || search.type || search.minScore || search.order,
  );

  const results = useQuery({
    queryKey: ["search", search.q, search.genre, search.year, search.status, search.type, search.minScore, search.order, page],
    queryFn: () =>
      jikan.search({
        q: search.q,
        page,
        genres: search.genre,
        year: search.year,
        status: search.status,
        type: search.type,
        minScore: search.minScore,
        orderBy: search.order,
        sort: search.order === "title" ? "asc" : "desc",
      }),
    enabled: hasFilter,
    placeholderData: keepPreviousData,
  });

  const apply = () =>
    navigate({
      search: {
        q: q.trim() || undefined,
        genre: genre || undefined,
        year: year || undefined,
        status: status || undefined,
        type: type || undefined,
        minScore: minScore || undefined,
        order: order || undefined,
        page: undefined,
      },
    });

  const goPage = (n: number) => {
    navigate({ search: prev => ({ ...prev, page: n > 1 ? n : undefined }) });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reset = () => navigate({ search: {} });

  const items = Array.isArray(results.data?.data) ? results.data.data : [];
  const hasNext = results.data?.pagination?.has_next_page ?? false;
  const showSkeleton = results.isLoading || (results.isFetching && items.length === 0);

  const field =
    "rounded-lg bg-white/5 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-neon-cyan";

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
          Search the full catalogue, or narrow it down by genre, type, status, rating and year.
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
          className={`min-w-[200px] flex-1 placeholder:text-white/40 ${field}`}
        />
        <select value={genre} onChange={e => setGenre(e.target.value)} aria-label="Genre" className={field}>
          <option value="">All genres</option>
          {genresQ.data?.data?.map(g => (
            <option key={`${g.mal_id}-${g.name}`} value={String(g.mal_id)} className="bg-background">
              {g.name}
            </option>
          ))}
        </select>
        <select value={type} onChange={e => setType(e.target.value)} aria-label="Type" className={field}>
          <option value="">Any type</option>
          {["tv", "movie", "ova", "special", "ona", "music"].map(t => (
            <option key={t} value={t} className="bg-background">
              {t.toUpperCase()}
            </option>
          ))}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} aria-label="Status" className={field}>
          <option value="">Any status</option>
          <option value="airing" className="bg-background">Airing</option>
          <option value="complete" className="bg-background">Completed</option>
          <option value="upcoming" className="bg-background">Upcoming</option>
        </select>
        <select value={minScore} onChange={e => setMinScore(e.target.value)} aria-label="Minimum score" className={field}>
          <option value="">Any rating</option>
          {["9", "8", "7", "6", "5"].map(s => (
            <option key={s} value={s} className="bg-background">
              {s}+ ★
            </option>
          ))}
        </select>
        <select value={order} onChange={e => setOrder(e.target.value)} aria-label="Sort by" className={field}>
          {ORDERS.map(o => (
            <option key={o.v} value={o.v} className="bg-background">
              {o.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          placeholder="Year"
          aria-label="Year"
          min={1950}
          max={2030}
          value={year}
          onChange={e => setYear(e.target.value)}
          className={`w-28 placeholder:text-white/40 ${field}`}
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
          hint="Type a title or pick a genre, type, status, rating or year above to see results."
        />
      ) : showSkeleton ? (
        <GridSkeleton count={18} />
      ) : results.isError ? (
        <ErrorState
          message={(results.error as Error)?.message}
          onRetry={() => results.refetch()}
          retrying={results.isFetching}
        />
      ) : items.length ? (
        <>
          <div className={results.isFetching ? "opacity-60 transition-opacity" : "transition-opacity"}>
            <AnimeGrid items={items} />
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => goPage(page - 1)}
              disabled={page <= 1 || results.isFetching}
              className="rounded-lg glass px-4 py-2 text-sm text-white/80 disabled:opacity-40"
            >
              ← Prev
            </button>
            <span className="text-sm text-white/60">Page {page}</span>
            <button
              type="button"
              onClick={() => goPage(page + 1)}
              disabled={!hasNext || results.isFetching}
              className="rounded-lg glass px-4 py-2 text-sm text-white/80 disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </>
      ) : (
        <EmptyState
          title="No results found"
          hint="Try a different spelling, or loosen the filters."
        />
      )}
    </div>
  );
}
