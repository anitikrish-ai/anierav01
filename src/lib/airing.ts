/** Next-episode airing info, resolved from AniList (Jikan has no countdown data). */

export interface NextAiring {
  episode: number;
  airingAt: number; // unix seconds
}

const cache = new Map<number, { t: number; v: NextAiring | null }>();
const TTL = 1000 * 60 * 10;

export async function getNextAiring(malId: number): Promise<NextAiring | null> {
  const hit = cache.get(malId);
  if (hit && Date.now() - hit.t < TTL) return hit.v;

  const query = `query ($id: Int) { Media(idMal: $id, type: ANIME) { nextAiringEpisode { episode airingAt } } }`;
  try {
    const r = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables: { id: malId } }),
    });
    if (!r.ok) throw new Error(String(r.status));
    const json = await r.json();
    const n = json?.data?.Media?.nextAiringEpisode;
    const v: NextAiring | null = n ? { episode: n.episode, airingAt: n.airingAt } : null;
    cache.set(malId, { t: Date.now(), v });
    return v;
  } catch {
    cache.set(malId, { t: Date.now(), v: null });
    return null;
  }
}

export function formatCountdown(secondsLeft: number): string {
  if (secondsLeft <= 0) return "Airing now";
  const d = Math.floor(secondsLeft / 86400);
  const h = Math.floor((secondsLeft % 86400) / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = Math.floor(secondsLeft % 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}
