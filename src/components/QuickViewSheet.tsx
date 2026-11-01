import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { GlassButton, GlassSheet } from "@zakisheriff/liquid-glass";
import { bestTitle, type Anime } from "@/lib/jikan";
import { getFavorites, toggleFavorite } from "@/lib/history";
import { Play, Bookmark, Check, Share2, ExternalLink, Star } from "lucide-react";

interface QuickViewSheetProps {
  anime: Anime | null;
  open: boolean;
  onClose: () => void;
}

export function QuickViewSheet({ anime, open, onClose }: QuickViewSheetProps) {
  const navigate = useNavigate();
  const [isFav, setIsFav] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (anime) {
      const favs = getFavorites();
      setIsFav(favs.includes(anime.mal_id));
    }
  }, [anime, open]);

  if (!anime) return null;

  const title = bestTitle(anime);
  const img = anime.images.webp?.large_image_url || anime.images.jpg.large_image_url;
  const genres = anime.genres
    ?.map((g) => g.name)
    .slice(0, 3)
    .join(" · ");

  const handleToggleFav = () => {
    const next = toggleFavorite(anime.mal_id);
    setIsFav(next);
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/anime/${anime.mal_id}`;
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleWatch = () => {
    onClose();
    navigate({
      to: "/watch/$id/$ep",
      params: { id: String(anime.mal_id), ep: "1" },
    });
  };

  const handleDetails = () => {
    onClose();
    navigate({
      to: "/anime/$id",
      params: { id: String(anime.mal_id) },
    });
  };

  return (
    <GlassSheet
      open={open}
      onClose={onClose}
      aria-label={`${title} preview`}
      detents={["medium", "large"]}
      intensity={6}
    >
      <div className="p-4 sm:p-6 text-foreground max-w-2xl mx-auto space-y-4">
        {/* Header with Artwork & Key Badges */}
        <div className="flex gap-4 items-start">
          <img
            src={img}
            alt={title}
            className="w-24 sm:w-32 aspect-[2/3] object-cover rounded-xl shadow-lg border border-white/10 shrink-0"
          />
          <div className="min-w-0 flex-1 space-y-1.5">
            <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-white line-clamp-2">
              {title}
            </h2>
            {anime.title_japanese && (
              <p className="text-xs text-muted-foreground truncate">{anime.title_japanese}</p>
            )}

            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
              {anime.score && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 text-cyan-300 font-semibold">
                  <Star size={12} className="fill-current text-cyan-300" />
                  {anime.score.toFixed(1)}
                </span>
              )}
              {anime.type && (
                <span className="px-2 py-0.5 rounded-md bg-white/10 text-white/90">
                  {anime.type}
                </span>
              )}
              {anime.episodes && (
                <span className="px-2 py-0.5 rounded-md bg-white/10 text-white/80">
                  {anime.episodes} eps
                </span>
              )}
              {anime.year && (
                <span className="px-2 py-0.5 rounded-md bg-white/10 text-white/70">
                  {anime.year}
                </span>
              )}
            </div>

            {genres && <p className="text-xs text-muted-foreground/80 pt-1">{genres}</p>}
          </div>
        </div>

        {/* Action Row with Liquid Glass Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
          <GlassButton
            variant="filled"
            tint="#8b5cf6"
            size="md"
            icon={<Play size={16} />}
            onClick={handleWatch}
            className="w-full font-semibold"
          >
            Watch Ep 1
          </GlassButton>

          <GlassButton
            variant={isFav ? "tinted-filled" : "glass"}
            tint={isFav ? "#c084fc" : undefined}
            size="md"
            icon={isFav ? <Check size={16} /> : <Bookmark size={16} />}
            onClick={handleToggleFav}
            className="w-full"
          >
            {isFav ? "Saved" : "Watchlist"}
          </GlassButton>

          <GlassButton
            variant="clear"
            size="md"
            icon={copied ? <Check size={16} /> : <Share2 size={16} />}
            onClick={handleShare}
            className="w-full"
          >
            {copied ? "Copied" : "Share"}
          </GlassButton>

          <GlassButton
            variant="clear"
            size="md"
            icon={<ExternalLink size={16} />}
            onClick={handleDetails}
            className="w-full"
          >
            Details
          </GlassButton>
        </div>

        {/* Synopsis */}
        {anime.synopsis && (
          <div className="pt-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Synopsis
            </h3>
            <p className="text-sm text-foreground/80 leading-relaxed max-h-48 overflow-y-auto pr-1">
              {anime.synopsis}
            </p>
          </div>
        )}
      </div>
    </GlassSheet>
  );
}
