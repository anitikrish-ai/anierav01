import { createFileRoute, Link } from "@tanstack/react-router";
import { CustomSources } from "@/components/CustomSources";
import { useEffect, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { jikan, bestTitle, type Anime } from "@/lib/jikan";
import { GridSkeleton, bestImage } from "@/components/AnimeCard";
import { ErrorState, EmptyState } from "@/components/StateBlocks";
import { Reveal } from "@/components/Reveal";
import { LiquidTabs } from "@/components/LiquidTabs";

const DAYS = [
  { id: "monday", label: "Mon" },
  { id: "tuesday", label: "Tue" },
  { id: "wednesday", label: "Wed" },
  { id: "thursday", label: "Thu" },
  { id: "friday", label: "Fri" },
  { id: "saturday", label: "Sat" },
  { id: "sunday", label: "Sun" },
] as const;

function localTodayId(): string {
  return DAYS[(new Date().getDay() + 6) % 7]!.id;
}

const searchSchema = z.object({ day: z.string().optional() });

export const Route = createFileRoute("/schedule")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Anime Airing Schedule 2026 — Weekly Calendar | AniEra" },
      {
        name: "description",
        content:
          "Weekly airing calendar for currently broadcasting anime. Track new episodes for the 2026 season, day by day, with countdowns and scores.",
      },
      { property: "og:title", content: "Anime Airing Schedule — AniEra" },
      { property: "og:description", content: "See what's airing today and across the week." },
      { property: "og:url", content: "https://aniera.lovable.app/schedule" },
    ],
    links: [{ rel: "canonical", href: "https://aniera.lovable.app/schedule" }],
  }),
  validateSearch: searchSchema,
  component: SchedulePage,
});

function SchedulePage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  // Resolved after mount so SSR and first client render agree (no hydration mismatch).
  const [clientToday, setClientToday] = useState("monday");
  useEffect(() => setClientToday(localTodayId()), []);
  const day = search.day ?? clientToday;

  const q = useQuery({
    queryKey: ["schedule", day],
    queryFn: () => jikan.schedules(day),
    staleTime: 1000 * 60 * 30,
  });

  // Jikan /schedules can occasionally contain duplicate mal_id entries
  const items = useMemo(() => {
    const raw = Array.isArray(q.data?.data) ? q.data.data : [];
    const seen = new Set<number>();
    const unique: Anime[] = [];
    for (const a of raw) {
      if (!a || typeof a.mal_id !== "number" || seen.has(a.mal_id)) continue;
      seen.add(a.mal_id);
      unique.push(a);
    }
    return unique;
  }, [q.data]);

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">Airing Schedule</h1>
        <p className="mt-1 text-sm text-white/60">Catch what's broadcasting this week.</p>
      </div>

      <LiquidTabs
        ariaLabel="Airing schedule day"
        options={DAYS.map((d) => d.label)}
        value={Math.max(
          0,
          DAYS.findIndex((d) => d.id === day),
        )}
        onChange={(idx) => navigate({ search: { day: DAYS[idx]?.id } })}
        size="md"
        wrap
        className="w-fit"
      />

      {q.isLoading ? (
        <GridSkeleton count={12} />
      ) : q.isError ? (
        <ErrorState
          message={(q.error as Error)?.message}
          onRetry={() => q.refetch()}
          retrying={q.isFetching}
        />
      ) : items.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((a, i) => {
            const img = bestImage(a);
            const time = (a as any).broadcast?.time as string | undefined;
            return (
              <Reveal key={a.mal_id} variant="rise" delay={Math.min(i % 12, 11) * 40}>
                <Link
                  to="/anime/$id"
                  params={{ id: String(a.mal_id) }}
                  preload="intent"
                  className="card-lift group flex gap-3 overflow-hidden rounded-2xl surface p-3 transition hover:border-primary/40 hover:bg-white/[0.06]"
                >
                  <img
                    src={img}
                    alt=""
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.opacity = "0";
                    }}
                    className="h-28 w-20 shrink-0 rounded-xl bg-white/5 object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {time && (
                        <span className="rounded-md border border-primary/25 bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-sky-300">
                          {time}
                        </span>
                      )}
                      {a.score ? (
                        <span className="text-[11px] font-medium text-amber-300">
                          ★ {a.score.toFixed(1)}
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-1.5 line-clamp-2 text-sm font-semibold text-white group-hover:text-sky-300 transition-colors">
                      {bestTitle(a)}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-[11px] text-white/55">
                      {a.synopsis ?? "—"}
                    </p>
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="Nothing scheduled for this day"
          hint="Pick another day of the week to see what's broadcasting."
        />
      )}

      <CustomSources searchable heading="Extra sources" />
    </div>
  );
}
