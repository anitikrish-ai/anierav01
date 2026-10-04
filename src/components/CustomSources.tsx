import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plug } from "lucide-react";
import { listEnabledCustomApis, callCustomApi } from "@/lib/custom-api";
import { useProxyPref } from "@/lib/proxy-pref";

type Item = { title: string; image?: string; sub?: string };

/** Best-effort extraction of title/image rows from arbitrary JSON responses. */
function extract(body: string): Item[] {
  let j: any;
  try { j = JSON.parse(body); } catch { return []; }
  const arr: any[] = Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : Array.isArray(j?.results) ? j.results : Array.isArray(j?.media) ? j.media : [];
  return arr.slice(0, 12).map(x => {
    const a = x?.attributes ?? x ?? {};
    const title = a.canonicalTitle ?? a.title_english ?? a.title?.english ?? a.title?.romaji ?? (typeof a.title === "string" ? a.title : null) ?? a.name;
    const image = a.posterImage?.small ?? a.images?.jpg?.image_url ?? a.coverImage?.medium ?? a.image ?? a.poster;
    const sub = a.subtype ?? a.type ?? a.status ?? a.startDate ?? "";
    return title ? { title: String(title), image: typeof image === "string" ? image : undefined, sub: String(sub ?? "") } : null;
  }).filter(Boolean) as Item[];
}

/** Shows results from admin-added custom APIs. Hidden when none are enabled. */
export function CustomSources({ query = "", heading = "Extra sources", searchable = false }: { query?: string; heading?: string; searchable?: boolean }) {
  const [own, setOwn] = useState("");
  const listFn = useServerFn(listEnabledCustomApis);
  const callFn = useServerFn(callCustomApi);
  const [proxyId] = useProxyPref();
  const apis = useQuery({ queryKey: ["custom-apis"], queryFn: () => listFn(), staleTime: 300_000 });
  const [slug, setSlug] = useState<string | null>(null);
  const active = slug ?? apis.data?.[0]?.slug ?? null;
  const q = (searchable && own.trim() ? own : query).trim();

  const res = useQuery({
    queryKey: ["custom-api-call", active, q, proxyId],
    queryFn: () => callFn({ data: { slug: active!, query: q, proxyId } }),
    enabled: !!active && q.length > 0,
    staleTime: 120_000,
    retry: false,
  });

  if (!apis.data?.length) return null;
  const items = res.data?.ok ? extract(res.data.body) : [];

  return (
    <section className="glass rounded-2xl p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Plug className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-bold text-white">{heading}</h2>
        <div className="ml-auto flex flex-wrap gap-1">
          {apis.data.map(a => (
            <button
              key={a.id}
              onClick={() => setSlug(a.slug)}
              className={`rounded-full px-3 py-1 text-xs ${a.slug === active ? "bg-primary text-primary-foreground" : "bg-white/10 text-white/70 hover:bg-white/20"}`}
            >
              {a.name}
            </button>
          ))}
        </div>
      </div>
      {searchable && (
        <input
          value={own}
          onChange={e => setOwn(e.target.value)}
          placeholder="Search this source…"
          className="mb-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
        />
      )}
      {!q ? (
        <p className="text-sm text-white/50">Search for a title to see results from this source.</p>
      ) : res.isLoading ? (
        <div className="h-24 rounded-xl shimmer" />
      ) : !res.data?.ok ? (
        <p className="text-sm text-white/50">This source is unavailable right now.</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-white/50">No matches from this source.</p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {items.map((it, i) => (
            <div key={i} className="min-w-0">
              {it.image ? (
                <img src={it.image} alt={it.title} loading="lazy" className="aspect-[2/3] w-full rounded-lg object-cover" />
              ) : (
                <div className="aspect-[2/3] w-full rounded-lg bg-white/5" />
              )}
              <div className="mt-1 truncate text-xs font-medium text-white">{it.title}</div>
              {it.sub && <div className="truncate text-[10px] text-white/40">{it.sub}</div>}
            </div>
          ))}
        </div>
      )}
      {res.data?.viaProxy && <p className="mt-2 text-[10px] text-white/40">Fetched via {res.data.viaProxy}</p>}
    </section>
  );
}
