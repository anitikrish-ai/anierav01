import { memo } from "react";
import { Link } from "@tanstack/react-router";
import type { Anime } from "@/lib/jikan";
import { bestTitle } from "@/lib/jikan";

function AnimeCardImpl({ anime }: { anime: Anime }) {
  const img = anime.images.webp?.large_image_url || anime.images.jpg.large_image_url;
  const title = bestTitle(anime);
  return (
    <Link
      to="/anime/$id"
      params={{ id: String(anime.mal_id) }}
      className="sheen group relative block overflow-hidden rounded-2xl glass transition-transform duration-300 hover:-translate-y-1.5 hover:glow-cyan"
      style={{ contentVisibility: "auto", containIntrinsicSize: "300px 450px" } as React.CSSProperties}
    >
      <div className="aspect-[2/3] overflow-hidden">
        <img
          src={img}
          alt={title}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 pt-10 transition-transform duration-300 group-hover:-translate-y-0.5">
        <h3 className="truncate text-sm font-semibold text-white">{title}</h3>
        <div className="mt-1 flex items-center justify-between text-[11px] text-white/70">
          <span>{anime.type ?? "—"} · {anime.episodes ?? "?"} ep</span>
          {anime.score ? (
            <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-medium text-neon-cyan">★ {anime.score.toFixed(1)}</span>
          ) : null}
        </div>
      </div>
      {anime.year ? (
        <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white">
          {anime.year}
        </span>
      ) : null}
    </Link>
  );
}

export const AnimeCard = memo(AnimeCardImpl, (a, b) => a.anime.mal_id === b.anime.mal_id);

export function AnimeGrid({ items }: { items: Anime[] }) {
  // Jikan can return the same title across pages/filters — de-dupe so React
  // keys stay unique, and drop malformed rows instead of crashing.
  const seen = new Set<number>();
  const safe = (Array.isArray(items) ? items : []).filter(a => {
    if (!a || typeof a.mal_id !== "number" || seen.has(a.mal_id)) return false;
    seen.add(a.mal_id);
    return true;
  });
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {safe.map((a, i) => (
        <div key={a.mal_id} className="anim-rise" style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}>
          <AnimeCard anime={a} />
        </div>
      ))}
    </div>
  );
}


export function CardSkeleton() {
  return <div className="aspect-[2/3] rounded-2xl shimmer" />;
}

export function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => <CardSkeleton key={i} />)}
    </div>
  );
}
