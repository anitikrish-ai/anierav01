import { Link } from "@tanstack/react-router";
import type { Anime } from "@/lib/jikan";
import { bestTitle } from "@/lib/jikan";

export function AnimeCard({ anime }: { anime: Anime }) {
  const img = anime.images.webp?.large_image_url || anime.images.jpg.large_image_url;
  return (
    <Link
      to="/anime/$id"
      params={{ id: String(anime.mal_id) }}
      className="group relative block overflow-hidden rounded-2xl glass transition-all duration-300 hover:-translate-y-1 hover:glow-cyan"
    >
      <div className="aspect-[2/3] overflow-hidden">
        <img
          src={img}
          alt={bestTitle(anime)}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 pt-10">
        <h3 className="truncate text-sm font-semibold text-white">{bestTitle(anime)}</h3>
        <div className="mt-1 flex items-center justify-between text-[11px] text-white/70">
          <span>{anime.type ?? "—"} · {anime.episodes ?? "?"} ep</span>
          {anime.score ? (
            <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-medium text-neon-cyan">★ {anime.score.toFixed(1)}</span>
          ) : null}
        </div>
      </div>
      {anime.year ? (
        <span className="absolute left-2 top-2 rounded-md bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-md">
          {anime.year}
        </span>
      ) : null}
    </Link>
  );
}

export function AnimeGrid({ items }: { items: Anime[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {items.map(a => <AnimeCard key={a.mal_id} anime={a} />)}
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