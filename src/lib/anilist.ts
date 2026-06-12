const CACHE_KEY = "aniera:mal2al";

function readCache(): Record<string, number | null> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); } catch { return {}; }
}

function writeCache(map: Record<string, number | null>) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(map)); } catch {}
}

/**
 * Resolve a MyAnimeList ID to its AniList ID via the public AniList GraphQL API.
 * Result is cached in localStorage. Returns null if unavailable.
 */
export async function malToAnilist(malId: number): Promise<number | null> {
  const key = String(malId);
  const cache = readCache();
  if (key in cache) return cache[key];

  const query = `query ($id: Int) { Media(idMal: $id, type: ANIME) { id } }`;
  try {
    const r = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables: { id: malId } }),
    });
    if (!r.ok) {
      cache[key] = null;
      writeCache(cache);
      return null;
    }
    const json = await r.json();
    const id: number | null = json?.data?.Media?.id ?? null;
    cache[key] = id;
    writeCache(cache);
    return id;
  } catch {
    return null;
  }
}