import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { jikan, bestTitle } from "@/lib/jikan";
import { GridSkeleton } from "@/components/AnimeCard";
import { ErrorState, EmptyState } from "@/components/StateBlocks";


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
      { title: "Anime Airing Schedule 2026 — Weekly Calendar | AniEra" },
      { name: "description", content: "Weekly airing calendar for currently broadcasting anime. Track new episodes for the 2026 season, day by day, with countdowns and scores." },
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

  const items = Array.isArray(q.data?.data) ? q.data.data : [];

  return (
    <div className="page-enter space-y-6">

      <div>
        <h1 className="font-display text-3xl font-bold text-white">Airing Schedule</h1>
        <p className="mt-1 text-sm text-white/60">Catch what's broadcasting this week.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {DAYS.map(d => {
          const active = d.id === day;
          return (
            <button
              key={d.id}
              onClick={() => navigate({ search: { day: d.id } })}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                active
                  ? "bg-gradient-to-r from-neon-cyan to-neon-magenta text-background"
                  : "glass text-white/80 hover:text-white"
              }`}
            >
              {d.label}
            </button>
          );
        })}
      </div>

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
          {items.map(a => {

            const img = a.images.webp?.image_url || a.images.jpg.image_url;
            const time = (a as any).broadcast?.time as string | undefined;
            return (
              <Link
                key={a.mal_id}
                to="/anime/$id"
                params={{ id: String(a.mal_id) }}
                className="group flex gap-3 overflow-hidden rounded-2xl glass p-3 transition hover:bg-white/5 hover:glow-cyan"
              >
                <img src={img} alt="" className="h-28 w-20 shrink-0 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {time && (
                      <span className="rounded-md bg-neon-cyan/15 px-2 py-0.5 text-[11px] font-semibold text-neon-cyan">
                        {time}
                      </span>
                    )}
                    {a.score && (
                      <span className="text-[11px] text-white/60">★ {a.score.toFixed(1)}</span>
                    )}
                  </div>
                  <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-white group-hover:text-neon-cyan">
                    {bestTitle(a)}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-[11px] text-white/55">
                    {a.synopsis ?? "—"}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="text-white/60">Nothing scheduled for this day.</p>
      )}
    </div>
  );
}