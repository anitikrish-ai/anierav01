import { memo, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { Anime } from "@/lib/jikan";
import { bestTitle } from "@/lib/jikan";
import { Reveal } from "@/components/Reveal";
import { QuickViewSheet } from "@/components/QuickViewSheet";
import { Film, Info } from "lucide-react";

export function bestImage(anime?: Partial<Anime> | null): string {
  return (
    anime?.images?.webp?.large_image_url ||
    anime?.images?.jpg?.large_image_url ||
    anime?.images?.webp?.image_url ||
    anime?.images?.jpg?.image_url ||
    ""
  );
}

function AnimeCardImpl({ anime, onQuickView }: { anime: Anime; onQuickView?: (a: Anime) => void }) {
  const img = bestImage(anime);
  const title = bestTitle(anime);
  const [loaded, setLoaded] = useState(!img);
  const [errored, setErrored] = useState(!img);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setLoaded(!img);
    setErrored(!img);
    const el = imgRef.current;
    if (el && el.complete) {
      setLoaded(true);
      if (el.naturalWidth === 0) setErrored(true);
    }
  }, [img]);

  return (
    <div className="relative group">
      <Link
        to="/anime/$id"
        params={{ id: String(anime.mal_id) }}
        preload="intent"
        className="sheen card-lift relative block overflow-hidden rounded-2xl surface"
      >
        <div className="relative aspect-[2/3] overflow-hidden bg-white/[0.03]">
          {/* Shimmer placeholder keeps the slot filled until the artwork fades in */}
          <div className="shimmer absolute inset-0" aria-hidden="true" data-hidden={loaded} />
          {!errored && img ? (
            <img
              ref={imgRef}
              src={img}
              alt={title}
              loading="lazy"
              decoding="async"
              onLoad={() => setLoaded(true)}
              onError={() => {
                setErrored(true);
                setLoaded(true);
              }}
              data-loaded={loaded}
              className="img-fade h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.07]"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-zinc-900 via-zinc-900/95 to-zinc-800 p-4 text-center">
              <Film size={28} className="text-white/30" aria-hidden="true" />
              <span className="line-clamp-2 text-xs font-medium text-white/50">{title}</span>
            </div>
          )}
        </div>
        <div className="on-media pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-3 pt-10 transition-transform duration-300 ease-out group-hover:-translate-y-0.5">
          <h3 className="truncate text-sm font-semibold text-white">{title}</h3>
          <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-white/70">
            <span className="truncate">
              {anime.type ?? "—"} · {anime.episodes ?? "?"} ep
            </span>
            {anime.score ? (
              <span className="shrink-0 rounded-md border border-amber-400/20 bg-amber-400/15 px-1.5 py-0.5 font-semibold text-amber-300">
                ★ {anime.score.toFixed(1)}
              </span>
            ) : null}
          </div>
        </div>
        {anime.year ? (
          <span className="on-media pointer-events-none absolute left-2 top-2 max-w-[calc(100%-56px)] truncate rounded-md bg-black/60 backdrop-blur-sm px-2 py-0.5 text-[10px] font-medium text-white">
            {anime.year}
          </span>
        ) : null}
      </Link>

      {onQuickView && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onQuickView(anime);
          }}
          aria-label={`Quick view ${title}`}
          className="on-media absolute right-2 top-2 z-10 flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-black/60 text-white/90 backdrop-blur-md border border-white/10 transition-all hover:scale-110 hover:bg-primary hover:text-white active:scale-90 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Info size={15} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export const AnimeCard = memo(
  AnimeCardImpl,
  (a, b) =>
    a.anime.mal_id === b.anime.mal_id &&
    a.anime.score === b.anime.score &&
    a.anime.episodes === b.anime.episodes &&
    a.onQuickView === b.onQuickView,
);

export function AnimeGrid({ items }: { items: Anime[] }) {
  const [selectedAnime, setSelectedAnime] = useState<Anime | null>(null);

  // Jikan can return the same title across pages/filters — de-dupe so React
  // keys stay unique, and drop malformed rows instead of crashing.
  const seen = new Set<number>();
  const safe = (Array.isArray(items) ? items : []).filter((a) => {
    if (!a || typeof a.mal_id !== "number" || seen.has(a.mal_id)) return false;
    seen.add(a.mal_id);
    return true;
  });

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {safe.map((a, i) => (
          <Reveal key={a.mal_id} variant="rise" delay={Math.min(i % 12, 11) * 40}>
            <AnimeCard anime={a} onQuickView={setSelectedAnime} />
          </Reveal>
        ))}
      </div>

      <QuickViewSheet
        anime={selectedAnime}
        open={!!selectedAnime}
        onClose={() => setSelectedAnime(null)}
      />
    </>
  );
}

export function CardSkeleton() {
  return <div className="aspect-[2/3] rounded-2xl shimmer" />;
}

export function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
