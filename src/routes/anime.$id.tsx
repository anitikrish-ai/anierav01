import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CustomSources } from "@/components/CustomSources";
import { useQuery } from "@tanstack/react-query";
import { jikan, bestTitle, type Anime } from "@/lib/jikan";
import { AnimeGrid, GridSkeleton, bestImage } from "@/components/AnimeCard";
import { useEffect, useMemo, useState } from "react";
import { getFavorites, toggleFavorite, getWatchedEpisodes } from "@/lib/history";
import { AiringCountdown } from "@/components/AiringCountdown";
import { Reviews } from "@/components/Reviews";
import { Reveal } from "@/components/Reveal";
import { GlassButton } from "@zakisheriff/liquid-glass";
import { Play } from "lucide-react";

export const Route = createFileRoute("/anime/$id")({
  head: ({ params }) => {
    const url = `https://aniera.lovable.app/anime/${params.id}`;
    return {
      meta: [
        { name: "twitter:card", content: "summary" },
        { title: `Anime #${params.id} — Watch on AniEra` },
        {
          name: "description",
          content: `Stream this anime on AniEra with sub & dub playback, full episode list, and frosted-glass UI.`,
        },
        { property: "og:title", content: `Watch on AniEra` },
        {
          property: "og:description",
          content: `Stream this anime — sub or dub, full episode tracker.`,
        },
        { property: "og:type", content: "video.tv_show" },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: AnimePage,
});

function AnimePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const malId = Number(id);
  const validId = Number.isInteger(malId) && malId > 0;

  const animeQ = useQuery({
    queryKey: ["anime", malId],
    queryFn: () => jikan.anime(malId),
    enabled: validId,
  });
  const epsQ = useQuery({
    queryKey: ["episodes", malId],
    queryFn: () => jikan.episodes(malId),
    enabled: validId && !!animeQ.data,
  });
  const recQ = useQuery({
    queryKey: ["rec", malId],
    queryFn: () => jikan.recommendations(malId),
    enabled: validId && !!animeQ.data,
  });
  const relQ = useQuery({
    queryKey: ["rel", malId],
    queryFn: () => jikan.relations(malId),
    enabled: validId && !!animeQ.data,
  });

  const [fav, setFav] = useState(false);
  const [watched, setWatched] = useState<Set<number>>(new Set());
  const [epRange, setEpRange] = useState(0);
  const [posterErr, setPosterErr] = useState(false);

  useEffect(() => {
    if (!validId) return;
    setFav(getFavorites().includes(malId));
    setWatched(new Set(getWatchedEpisodes(malId)));
    setEpRange(0);
    setPosterErr(false);
  }, [malId, validId]);

  const recItems = useMemo(
    () =>
      (recQ.data?.data ?? [])
        .slice(0, 12)
        .map((r: any) => r?.entry)
        .filter((e: any): e is Anime => !!e && typeof e.mal_id === "number"),
    [recQ.data],
  );

  if (!validId) {
    return (
      <div className="py-20 text-center space-y-4">
        <h2 className="text-2xl font-bold text-white">Invalid anime ID</h2>
        <p className="text-sm text-white/60 max-w-md mx-auto">
          The requested anime identifier is not valid.
        </p>
        <Link
          to="/browse"
          className="inline-flex items-center rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white"
        >
          Browse Anime
        </Link>
      </div>
    );
  }

  if (animeQ.isError) {
    return (
      <div className="py-20 text-center space-y-4">
        <h2 className="text-2xl font-bold text-white">Anime unavailable</h2>
        <p className="text-sm text-white/60 max-w-md mx-auto">
          {(animeQ.error as Error)?.message || "Could not load anime details. Please try again."}
        </p>
        <GlassButton variant="tinted-filled" tint="#0a84ff" onClick={() => animeQ.refetch()}>
          Retry
        </GlassButton>
      </div>
    );
  }
  if (animeQ.isLoading || !animeQ.data) return <div className="h-96 rounded-3xl shimmer" />;
  const a = animeQ.data.data;
  const img = bestImage(a);
  const eps = epsQ.data?.data ?? [];
  const totalEps = a.episodes ?? eps.length;
  const episodeList =
    totalEps && eps.length === 0
      ? Array.from({ length: totalEps }).map((_, i) => ({
          mal_id: i + 1,
          title: `Episode ${i + 1}`,
        }))
      : eps;

  const pageSize = 100;
  const totalPages = Math.ceil(episodeList.length / pageSize);
  const visibleEps = episodeList.slice(epRange * pageSize, (epRange + 1) * pageSize);

  return (
    <div className="space-y-10 page-enter">
      <section className="on-media relative overflow-hidden rounded-3xl border border-white/12 bg-[#0b0b0e] shadow-2xl">
        {img && !posterErr && (
          <div
            className="anim-hero-bg absolute inset-0 blur-2xl"
            style={{
              backgroundImage: `url(${img})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              opacity: 0.42,
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/75 to-[#09090b]/35" />
        <div className="relative grid gap-6 p-5 sm:p-8 lg:p-10 md:grid-cols-[230px_1fr] items-start">
          {img && !posterErr ? (
            <img
              src={img}
              alt={bestTitle(a)}
              onError={() => setPosterErr(true)}
              className="anim-pop mx-auto md:mx-0 aspect-[2/3] w-44 sm:w-56 md:w-full rounded-2xl object-cover border border-white/15 shadow-2xl"
            />
          ) : (
            <div className="mx-auto md:mx-0 aspect-[2/3] w-44 sm:w-56 md:w-full rounded-2xl bg-white/5 border border-white/10" />
          )}
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold text-white sm:text-4xl leading-tight">
              {bestTitle(a)}
            </h1>
            {a.title_japanese && (
              <p className="mt-1 text-sm text-white/60 truncate">{a.title_japanese}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/85">
              {a.score ? (
                <span className="rounded-md border border-amber-400/25 bg-amber-400/15 px-2.5 py-1 font-semibold text-amber-300">
                  ★ {a.score.toFixed(1)}
                </span>
              ) : null}
              {a.type ? <span className="rounded-md bg-white/10 px-2.5 py-1">{a.type}</span> : null}
              {a.episodes ? (
                <span className="rounded-md bg-white/10 px-2.5 py-1">{a.episodes} eps</span>
              ) : null}
              {a.status ? (
                <span className="rounded-md bg-white/10 px-2.5 py-1">{a.status}</span>
              ) : null}
              {a.year ? <span className="rounded-md bg-white/10 px-2.5 py-1">{a.year}</span> : null}
              {a.duration ? (
                <span className="rounded-md bg-white/10 px-2.5 py-1">{a.duration}</span>
              ) : null}
              <AiringCountdown malId={malId} />
            </div>
            {a.genres?.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {a.genres.map((g) => (
                  <Link
                    key={g.mal_id}
                    to="/browse"
                    search={{ genre: String(g.mal_id) } as any}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 hover:bg-white/15 hover:text-white transition"
                  >
                    {g.name}
                  </Link>
                ))}
              </div>
            ) : null}
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/80">
              {a.synopsis || "No synopsis available for this title."}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <GlassButton
                variant="filled"
                tint="#0a84ff"
                size="md"
                icon={<Play size={15} />}
                onClick={() =>
                  navigate({
                    to: "/watch/$id/$ep",
                    params: { id: String(a.mal_id), ep: "1" },
                  })
                }
                className="font-semibold"
              >
                Watch Episode 1
              </GlassButton>
              <GlassButton
                variant={fav ? "tinted-filled" : "clear"}
                tint={fav ? "#0a84ff" : undefined}
                size="md"
                onClick={() => setFav(toggleFavorite(malId))}
              >
                {fav ? "♥ In Favorites" : "♡ Add to Favorites"}
              </GlassButton>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Reveal variant="slide-left" as="div">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-white">Episodes</h2>
          </Reveal>
          {totalPages > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: totalPages }).map((_, idx) => {
                const start = idx * pageSize + 1;
                const end = Math.min((idx + 1) * pageSize, episodeList.length);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setEpRange(idx)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                      epRange === idx
                        ? "bg-primary text-white"
                        : "glass text-white/70 hover:text-white"
                    }`}
                  >
                    {start}–{end}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {epsQ.isLoading && episodeList.length === 0 ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl shimmer" />
            ))}
          </div>
        ) : episodeList.length === 0 ? (
          <p className="text-sm text-white/60">No episode data available.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {visibleEps.map((ep, idx) => {
              const epNumber = epRange * pageSize + idx + 1;
              const isWatched = watched.has(epNumber);
              return (
                <Link
                  key={ep.mal_id ?? epNumber}
                  to="/watch/$id/$ep"
                  params={{ id: String(a.mal_id), ep: String(epNumber) }}
                  preload="intent"
                  className={`sheen surface rounded-xl p-3 text-sm transition hover:-translate-y-0.5 hover:bg-white/10 hover:text-white ${
                    isWatched ? "ring-1 ring-primary/50 text-white" : "text-white/85"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-sky-400">EP {epNumber}</span>
                    {isWatched && (
                      <span className="text-sky-400" title="Watched">
                        ✓
                      </span>
                    )}
                  </div>
                  <div className="mt-1 line-clamp-2 text-[13px]">
                    {ep.title || `Episode ${epNumber}`}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {recQ.isLoading || recItems.length > 0 ? (
        <section>
          <Reveal variant="slide-left" as="div">
            <h2 className="mb-4 font-display text-xl sm:text-2xl font-bold text-white">
              You Might Also Like
            </h2>
          </Reveal>
          {recQ.isLoading ? <GridSkeleton /> : <AnimeGrid items={recItems} />}
        </section>
      ) : null}

      {relQ.data?.data?.length ? (
        <section>
          <Reveal variant="slide-left" as="div">
            <h2 className="mb-4 font-display text-xl sm:text-2xl font-bold text-white">
              Franchise &amp; Related
            </h2>
          </Reveal>
          <div className="space-y-4">
            {relQ.data.data.map((rel, i) => (
              <Reveal
                key={`${rel.relation}-${i}`}
                variant="rise"
                delay={i * 40}
                className="surface block rounded-2xl p-4"
              >
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-sky-400">
                  {rel.relation}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {rel.entry.map((e) =>
                    e.type === "anime" ? (
                      <Link
                        key={e.mal_id}
                        to="/anime/$id"
                        params={{ id: String(e.mal_id) }}
                        preload="intent"
                        className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/85 transition hover:bg-white/20 hover:text-white"
                      >
                        {e.name}
                      </Link>
                    ) : (
                      <span
                        key={`${e.type}-${e.mal_id}`}
                        className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-white/50"
                      >
                        {e.name}
                      </span>
                    ),
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}

      <CustomSources query={bestTitle(a)} heading="More from extra sources" />

      <Reviews malId={malId} animeTitle={bestTitle(a)} />
    </div>
  );
}
