import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getFavorites, getHistory, type HistoryEntry } from "@/lib/history";
import { jikan } from "@/lib/jikan";
import { AnimeGrid } from "@/components/AnimeCard";
import { useAuth } from "@/lib/auth";
import { listLibrary, deleteEntry, upsertEntry, bulkUpsert } from "@/lib/library.functions";
import { ErrorState, EmptyState } from "@/components/StateBlocks";
import { exportJSON, exportMAL, exportCSV, parseListFile, downloadText, type LibEntry, type LibStatus } from "@/lib/listFormats";

export const Route = createFileRoute("/library")({
  head: () => ({ meta: [{ title: "Your Library — AniEra" }] }),
  component: LibraryPage,
});

const STATUSES: { key: LibStatus | "all" | "favorites"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "favorites", label: "Favorites" },
  { key: "watching", label: "Watching" },
  { key: "completed", label: "Completed" },
  { key: "plan_to_watch", label: "Plan to Watch" },
  { key: "on_hold", label: "On Hold" },
  { key: "dropped", label: "Dropped" },
];

function LibraryPage() {
  const { signedIn, loading: authLoading } = useAuth();
  return authLoading ? <div className="h-96 rounded-3xl shimmer" /> : signedIn ? <CloudLibrary /> : <LocalLibrary />;
}

function CloudLibrary() {
  const qc = useQueryClient();
  const fetchLibrary = useServerFn(listLibrary);
  const del = useServerFn(deleteEntry);
  const upsert = useServerFn(upsertEntry);
  const bulk = useServerFn(bulkUpsert);

  const libQ = useQuery({ queryKey: ["library"], queryFn: () => fetchLibrary() });
  const [tab, setTab] = useState<LibStatus | "all" | "favorites">("all");

  const all: LibEntry[] = (libQ.data ?? []).map((r: any) => ({
    mal_id: r.mal_id, title: r.title, image: r.image, status: r.status,
    score: r.score, episodes_watched: r.episodes_watched, total_episodes: r.total_episodes,
    is_favorite: r.is_favorite, notes: r.notes,
  }));
  const filtered = all.filter(e =>
    tab === "all" ? true :
    tab === "favorites" ? e.is_favorite : e.status === tab,
  );

  const delMut = useMutation({
    mutationFn: (mal_id: number) => del({ data: { mal_id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["library"] }),
  });
  const upsertMut = useMutation({
    mutationFn: (e: LibEntry) => upsert({ data: e as any }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["library"] }),
  });
  const importMut = useMutation({
    mutationFn: async (file: File) => {
      const entries = parseListFile(await file.text());
      if (!entries.length) throw new Error("No valid entries found");
      return bulk({ data: { entries } as any });
    },
    onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ["library"] }); toast.success(`Imported ${r.inserted} entries`); },
    onError: (e: any) => toast.error(e?.message ?? "Import failed"),
  });

  const download = (fmt: "json" | "xml" | "csv") => {
    if (!all.length) { toast.info("Your library is empty."); return; }
    const stamp = new Date().toISOString().slice(0, 10);
    if (fmt === "json") downloadText(`aniera-${stamp}.json`, exportJSON(all), "application/json");
    if (fmt === "xml") downloadText(`animelist-${stamp}.xml`, exportMAL(all), "application/xml");
    if (fmt === "csv") downloadText(`aniera-${stamp}.csv`, exportCSV(all), "text/csv");
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold text-white">Your Library</h1>
        <div className="flex flex-wrap gap-2">
          <label className="cursor-pointer rounded-lg glass px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10">
            Import
            <input type="file" accept=".json,.xml,.csv,.txt" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) importMut.mutate(f); e.target.value = ""; }} />
          </label>
          <button onClick={() => download("json")} className="rounded-lg glass px-3 py-1.5 text-xs text-white hover:bg-white/10">JSON</button>
          <button onClick={() => download("xml")} className="rounded-lg glass px-3 py-1.5 text-xs text-white hover:bg-white/10">MAL XML</button>
          <button onClick={() => download("csv")} className="rounded-lg glass px-3 py-1.5 text-xs text-white hover:bg-white/10">CSV</button>
          <Link to="/profile" className="rounded-lg bg-gradient-to-r from-neon-cyan to-neon-magenta px-3 py-1.5 text-xs font-semibold text-background">Profile</Link>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2 overflow-x-auto">
        {STATUSES.map(s => {
          const active = tab === s.key;
          const count = s.key === "all" ? all.length : s.key === "favorites" ? all.filter(e => e.is_favorite).length : all.filter(e => e.status === s.key).length;
          return (
            <button key={s.key} onClick={() => setTab(s.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${active ? "bg-gradient-to-r from-neon-cyan to-neon-magenta text-background" : "glass text-white/70 hover:text-white"}`}>
              {s.label} <span className="opacity-60">({count})</span>
            </button>
          );
        })}
      </nav>

      {libQ.isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-2xl shimmer" />
          ))}
        </div>
      ) : libQ.error ? (
        <ErrorState message={(libQ.error as any)?.message} onRetry={() => libQ.refetch()} retrying={libQ.isFetching} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={tab === "all" ? "Your library is empty" : "Nothing in this list"}
          hint={tab === "all"
            ? "Add anime from a series page, or import an existing MyAnimeList export."
            : "Move a title into this status from its card, or pick another tab."}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {filtered.map(e => (
            <div key={e.mal_id} className="group relative overflow-hidden rounded-2xl glass">
              <Link to="/watch/$id/$ep" params={{ id: String(e.mal_id), ep: String(Math.max(1, e.episodes_watched || 1)) }}>
                <div className="aspect-[2/3] overflow-hidden">
                  {e.image ? <img src={e.image} alt={e.title} className="h-full w-full object-cover transition group-hover:scale-110" /> :
                    <div className="h-full w-full bg-white/5" />}
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-3 pt-8">
                  <h3 className="truncate text-sm font-semibold text-white">{e.title}</h3>
                  <p className="text-[11px] text-white/70">
                    {e.episodes_watched}/{e.total_episodes ?? "?"} eps · {e.status.replace(/_/g, " ")}{e.score ? ` · ★${e.score}` : ""}
                  </p>
                </div>
              </Link>
              <div className="absolute right-2 top-2 flex flex-col gap-1 opacity-0 transition group-hover:opacity-100">
                <button onClick={() => upsertMut.mutate({ ...e, is_favorite: !e.is_favorite })}
                  title={e.is_favorite ? "Unfavorite" : "Favorite"}
                  className={`rounded-md px-2 py-1 text-xs ${e.is_favorite ? "bg-neon-magenta text-background" : "bg-black/60 text-white"}`}>
                  {e.is_favorite ? "♥" : "♡"}
                </button>
                <button onClick={() => { if (confirm(`Remove ${e.title}?`)) delMut.mutate(e.mal_id); }}
                  className="rounded-md bg-black/60 px-2 py-1 text-xs text-white hover:bg-red-500/70">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LocalLibrary() {
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
  const favError = favQueries.find(q => q.error)?.error;
  const favLoading = favQueries.some(q => q.isFetching);

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold text-white">Your Library</h1>
        <Link to="/auth" className="rounded-lg bg-gradient-to-r from-neon-cyan to-neon-magenta px-4 py-2 text-xs font-semibold text-background">
          Sign in to sync & import
        </Link>
      </header>
      <p className="text-sm text-white/60">You're browsing as a guest — your favorites and history live on this device only. Sign in to sync across devices, import a MAL list, and export to JSON / XML / CSV.</p>

      <section>
        <h2 className="mb-4 font-display text-xl font-bold text-white">Continue Watching</h2>
        {history.length === 0 ? (
          <EmptyState title="Nothing watched yet" hint="Pick a series and hit play — your progress shows up here." />
        ) : (
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
        {favIds.length === 0 ? (
          <EmptyState title="No favorites yet" hint="Tap the heart on any anime to keep it here." />
        ) : favError ? (
          <ErrorState
            message={(favError as any)?.message}
            onRetry={() => favQueries.forEach(q => q.refetch())}
            retrying={favLoading}
          />
        ) : favs.length === 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {favIds.slice(0, 6).map(id => <div key={id} className="aspect-[2/3] rounded-2xl shimmer" />)}
          </div>
        ) : (
          <AnimeGrid items={favs} />
        )}
      </section>
    </div>
  );
}