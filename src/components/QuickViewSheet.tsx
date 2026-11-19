import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { GlassButton } from "@zakisheriff/liquid-glass";
import { bestTitle, type Anime } from "@/lib/jikan";
import { getFavorites, toggleFavorite } from "@/lib/history";
import { Play, Bookmark, Check, Share2, ExternalLink, Star, X, Film } from "lucide-react";

interface QuickViewSheetProps {
  anime: Anime | null;
  open: boolean;
  onClose: () => void;
}

export function QuickViewSheet({ anime, open, onClose }: QuickViewSheetProps) {
  const navigate = useNavigate();
  const [isFav, setIsFav] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imgErr, setImgErr] = useState(false);

  useEffect(() => {
    setImgErr(false);
    if (anime) {
      const favs = getFavorites();
      setIsFav(favs.includes(anime.mal_id));
    }
  }, [anime, open]);

  // Handle escape key and lock body scroll while modal is active
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || !anime) return null;

  const title = bestTitle(anime);
  const img =
    anime.images?.webp?.large_image_url ||
    anime.images?.jpg?.large_image_url ||
    anime.images?.jpg?.image_url ||
    "";
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
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} preview`}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/82 backdrop-blur-lg anim-fade"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="on-media relative w-full max-w-xl max-h-[88vh] sm:max-h-[90vh] overflow-y-auto no-scrollbar rounded-t-[30px] sm:rounded-[30px] bg-[#121216]/96 border border-white/15 backdrop-blur-3xl shadow-[0_28px_70px_-15px_rgba(0,0,0,0.9)] p-5 sm:p-6 text-white anim-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="w-12 h-1.5 rounded-full bg-white/20 mx-auto mb-4 sm:hidden" />

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-4 top-4 p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors focus:outline-none"
        >
          <X size={18} />
        </button>

        {/* Header with Artwork & Key Badges */}
        <div className="anim-rise flex gap-4 sm:gap-5 items-start pr-11">
          {img && !imgErr ? (
            <img
              src={img}
              alt={title}
              onError={() => setImgErr(true)}
              className="anim-pop w-24 sm:w-32 aspect-[2/3] object-cover rounded-2xl bg-white/5 shadow-xl border border-white/10 shrink-0"
            />
          ) : (
            <div className="flex w-24 sm:w-32 aspect-[2/3] items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-white/30 shrink-0">
              <Film size={24} />
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-1.5">
            <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-white line-clamp-2">
              {title}
            </h2>
            {anime.title_japanese && (
              <p className="text-xs text-white/60 truncate">{anime.title_japanese}</p>
            )}

            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
              {anime.score ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-400/15 border border-amber-400/25 text-amber-300 font-semibold shadow-sm">
                  <Star size={12} className="fill-current text-amber-300" />
                  {anime.score.toFixed(1)}
                </span>
              ) : null}
              {anime.type ? (
                <span className="px-2 py-0.5 rounded-md bg-white/10 text-white/90">
                  {anime.type}
                </span>
              ) : null}
              {anime.episodes ? (
                <span className="px-2 py-0.5 rounded-md bg-white/10 text-white/80">
                  {anime.episodes} eps
                </span>
              ) : null}
              {anime.year ? (
                <span className="px-2 py-0.5 rounded-md bg-white/10 text-white/70">
                  {anime.year}
                </span>
              ) : null}
            </div>

            {genres && <p className="text-xs text-white/60 pt-1">{genres}</p>}
          </div>
        </div>

        {/* Action Row with Liquid Glass Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-4">
          <GlassButton
            variant="filled"
            tint="#0a84ff"
            size="md"
            icon={<Play size={16} />}
            onClick={handleWatch}
            className="w-full font-semibold"
          >
            Watch Ep 1
          </GlassButton>

          <GlassButton
            variant={isFav ? "tinted-filled" : "glass"}
            tint={isFav ? "#0a84ff" : undefined}
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
          <div className="pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/55 mb-1.5">
              Synopsis
            </h3>
            <p className="text-sm text-white/85 leading-relaxed max-h-44 overflow-y-auto pr-1 no-scrollbar">
              {anime.synopsis}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
