import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listReviews, upsertReview, deleteReview, type ReviewRow } from "@/lib/reviews.functions";
import { useAuth } from "@/lib/auth";
import { ErrorState } from "@/components/StateBlocks";

export function Reviews({ malId, animeTitle }: { malId: number; animeTitle: string }) {
  const { user, signedIn } = useAuth();
  const qc = useQueryClient();
  const load = useServerFn(listReviews);
  const save = useServerFn(upsertReview);
  const remove = useServerFn(deleteReview);

  const q = useQuery({
    queryKey: ["reviews", malId],
    queryFn: () => load({ data: { mal_id: malId } }),
  });

  const mine = q.data?.reviews.find(r => r.user_id === user?.id) ?? null;

  const [body, setBody] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [spoiler, setSpoiler] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setBody(mine?.body ?? "");
    setRating(mine?.rating ?? null);
    setSpoiler(mine?.spoiler ?? false);
  }, [mine?.id]);

  const saveM = useMutation({
    mutationFn: () =>
      save({
        data: {
          mal_id: malId,
          anime_title: animeTitle,
          rating,
          body: body.trim(),
          spoiler,
          author_name:
            (user?.user_metadata?.["full_name"] as string) ||
            (user?.user_metadata?.["name"] as string) ||
            user?.email?.split("@")[0] ||
            "Anonymous",
          author_avatar: (user?.user_metadata?.["avatar_url"] as string) || null,
        },
      }),
    onSuccess: () => {
      setErr(null);
      qc.invalidateQueries({ queryKey: ["reviews", malId] });
    },
    onError: (e: Error) => setErr(e.message),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reviews", malId] }),
  });

  const reviews = q.data?.reviews ?? [];
  const avg =
    reviews.filter(r => r.rating).reduce((s, r) => s + (r.rating ?? 0), 0) /
    (reviews.filter(r => r.rating).length || 1);

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-2xl font-bold text-white">Reviews & Comments</h2>
        {reviews.some(r => r.rating) && (
          <span className="rounded-full glass px-3 py-1 text-xs text-white/80">
            Community score ★ {avg.toFixed(1)} · {reviews.length} review{reviews.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {signedIn ? (
        <form
          onSubmit={e => {
            e.preventDefault();
            if (body.trim().length < 2) return;
            saveM.mutate();
          }}
          className="glass rounded-2xl p-4"
        >
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder={mine ? "Update your review…" : "Share your thoughts on this anime…"}
            aria-label="Your review"
            className="w-full resize-y rounded-lg bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none ring-1 ring-white/10 focus:ring-neon-cyan"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-white/70">
              Rating
              <select
                value={rating ?? ""}
                onChange={e => setRating(e.target.value ? Number(e.target.value) : null)}
                className="rounded-lg bg-white/5 px-2 py-1.5 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-neon-cyan"
              >
                <option value="" className="bg-background">—</option>
                {Array.from({ length: 10 }, (_, i) => 10 - i).map(n => (
                  <option key={n} value={n} className="bg-background">{n}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-white/70">
              <input type="checkbox" checked={spoiler} onChange={e => setSpoiler(e.target.checked)} />
              Contains spoilers
            </label>
            <button
              type="submit"
              disabled={saveM.isPending || body.trim().length < 2}
              className="ml-auto rounded-lg bg-gradient-to-r from-neon-cyan to-neon-magenta px-4 py-2 text-sm font-semibold text-background transition hover:scale-105 disabled:opacity-50"
            >
              {saveM.isPending ? "Saving…" : mine ? "Update review" : "Post review"}
            </button>
            {mine && (
              <button
                type="button"
                onClick={() => deleteM.mutate(mine.id)}
                className="rounded-lg bg-white/5 px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white"
              >
                Delete
              </button>
            )}
          </div>
          {err && <p className="mt-2 text-xs text-neon-magenta">{err}</p>}
        </form>
      ) : (
        <div className="glass rounded-2xl p-4 text-sm text-white/70">
          <Link to="/auth" className="font-semibold text-neon-cyan hover:underline">Sign in</Link> to post a review
          or rate this anime.
        </div>
      )}

      <div className="mt-4 space-y-3">
        {q.isLoading ? (
          <div className="h-24 rounded-2xl shimmer" />
        ) : q.isError ? (
          <ErrorState message={(q.error as Error)?.message} onRetry={() => q.refetch()} retrying={q.isFetching} />
        ) : reviews.length === 0 ? (
          <p className="text-sm text-white/60">No reviews yet — be the first to write one.</p>
        ) : (
          reviews.map(r => <ReviewCard key={r.id} r={r} own={r.user_id === user?.id} />)
        )}
      </div>
    </section>
  );
}

function ReviewCard({ r, own }: { r: ReviewRow; own: boolean }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <article className="glass rounded-2xl p-4">
      <div className="flex items-center gap-3">
        {r.author_avatar ? (
          <img src={r.author_avatar} alt="" loading="lazy" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs text-white">
            {r.author_name.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">
            {r.author_name}{own && <span className="ml-2 text-[11px] text-neon-cyan">you</span>}
          </p>
          <p className="text-[11px] text-white/50">{new Date(r.created_at).toLocaleDateString()}</p>
        </div>
        {r.rating && (
          <span className="ml-auto rounded-md bg-white/10 px-2 py-1 text-xs text-white">★ {r.rating}</span>
        )}
      </div>
      {r.spoiler && !revealed ? (
        <button
          onClick={() => setRevealed(true)}
          className="mt-3 w-full rounded-lg bg-white/5 px-3 py-2 text-xs text-white/70 hover:bg-white/10"
        >
          Spoiler — click to reveal
        </button>
      ) : (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/80">{r.body}</p>
      )}
    </article>
  );
}
