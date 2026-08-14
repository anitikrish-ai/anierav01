const BASE = "https://api.jikan.moe/v4";

export interface AnimeImage {
  jpg: { image_url: string; large_image_url: string };
  webp?: { image_url: string; large_image_url: string };
}

export interface Anime {
  mal_id: number;
  url: string;
  images: AnimeImage;
  title: string;
  title_english: string | null;
  title_japanese: string | null;
  type: string | null;
  episodes: number | null;
  status: string | null;
  score: number | null;
  scored_by: number | null;
  rank: number | null;
  popularity: number | null;
  synopsis: string | null;
  year: number | null;
  season: string | null;
  genres: { mal_id: number; name: string }[];
  studios: { mal_id: number; name: string }[];
  duration: string | null;
  rating: string | null;
  trailer?: { youtube_id: string | null; url: string | null; embed_url: string | null };
}

export interface Episode {
  mal_id: number;
  title: string;
  title_japanese?: string | null;
  aired?: string | null;
  filler?: boolean;
  recap?: boolean;
}

interface JikanList<T> { data: T[]; pagination?: { has_next_page: boolean; current_page: number; last_visible_page: number } }
interface JikanItem<T> { data: T }

/* ------------------------------------------------------------------
 * Resilient Jikan client
 * Jikan v4 allows ~3 req/s and 60 req/min. The app fires many parallel
 * queries, so requests are funnelled through a serialised queue with a
 * minimum gap, retried with backoff on 429/5xx, de-duplicated while in
 * flight, and cached in memory (+ sessionStorage) for the TTL.
 * ---------------------------------------------------------------- */

const MIN_GAP_MS = 400; // ~2.5 req/s, under Jikan's 3/s limit
const MAX_RETRIES = 3;
const CACHE_TTL_MS = 1000 * 60 * 10;

type CacheRec = { t: number; v: unknown };

const memCache = new Map<string, CacheRec>();
const inflight = new Map<string, Promise<unknown>>();

let chain: Promise<void> = Promise.resolve();
let lastSent = 0;

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

function readSession(key: string): CacheRec | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(`jikan:${key}`);
    return raw ? (JSON.parse(raw) as CacheRec) : null;
  } catch {
    return null;
  }
}

function writeSession(key: string, rec: CacheRec) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(`jikan:${key}`, JSON.stringify(rec));
  } catch {
    /* quota exceeded — memory cache still applies */
  }
}

/** Queue one fetch so calls never burst past Jikan's rate limit. */
function schedule<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = MIN_GAP_MS - (Date.now() - lastSent);
    if (wait > 0) await sleep(wait);
    lastSent = Date.now();
  });
  chain = run.catch(() => {});
  return run.then(task);
}

async function fetchWithRetry(url: string): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await schedule(() => fetch(url, { headers: { Accept: "application/json" } }));
      if (res.ok) return res;
      // 429 = rate limited, 5xx = upstream hiccup → both worth retrying
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`Jikan ${res.status}`);
        const retryAfter = Number(res.headers.get("retry-after"));
        const backoff = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : Math.min(500 * 2 ** attempt, 4000) + Math.random() * 250;
        if (attempt < MAX_RETRIES) {
          await sleep(backoff);
          continue;
        }
      }
      throw new Error(`Jikan ${res.status}`);
    } catch (e) {
      lastErr = e;
      if (attempt >= MAX_RETRIES) break;
      await sleep(Math.min(500 * 2 ** attempt, 4000));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Jikan request failed");
}

async function jget<T>(path: string): Promise<T> {
  const now = Date.now();

  const cached = memCache.get(path) ?? readSession(path);
  if (cached && now - cached.t < CACHE_TTL_MS) {
    memCache.set(path, cached);
    return cached.v as T;
  }

  const pending = inflight.get(path);
  if (pending) return pending as Promise<T>;

  const p = (async () => {
    const res = await fetchWithRetry(`${BASE}${path}`);
    const json = (await res.json()) as T;
    const rec: CacheRec = { t: Date.now(), v: json };
    memCache.set(path, rec);
    writeSession(path, rec);
    return json;
  })().finally(() => {
    inflight.delete(path);
  });

  inflight.set(path, p);
  return p;
}


export const jikan = {
  topAiring: (page = 1) => jget<JikanList<Anime>>(`/top/anime?filter=airing&page=${page}`),
  topPopular: (page = 1) => jget<JikanList<Anime>>(`/top/anime?filter=bypopularity&page=${page}`),
  topRated: (page = 1) => jget<JikanList<Anime>>(`/top/anime?page=${page}`),
  seasonNow: (page = 1) => jget<JikanList<Anime>>(`/seasons/now?page=${page}`),
  seasonUpcoming: (page = 1) => jget<JikanList<Anime>>(`/seasons/upcoming?page=${page}`),
  schedules: (filter?: string, page = 1) => {
    const params = new URLSearchParams({ page: String(page), sfw: "true", limit: "25" });
    if (filter) params.set("filter", filter);
    return jget<JikanList<Anime>>(`/schedules?${params.toString()}`);
  },
  search: (q: string, page = 1, genres?: string, year?: string, status?: string, type?: string) => {
    const params = new URLSearchParams({ q, page: String(page), sfw: "true", limit: "24" });
    if (genres) params.set("genres", genres);
    if (year) params.set("start_date", `${year}-01-01`);
    if (status) params.set("status", status);
    if (type) params.set("type", type);
    return jget<JikanList<Anime>>(`/anime?${params.toString()}`);
  },
  anime: (id: number) => jget<JikanItem<Anime>>(`/anime/${id}/full`),
  episodes: (id: number, page = 1) => jget<JikanList<Episode>>(`/anime/${id}/episodes?page=${page}`),
  recommendations: (id: number) => jget<JikanList<{ entry: Anime }>>(`/anime/${id}/recommendations`),
  genres: () => jget<JikanList<{ mal_id: number; name: string; count: number }>>(`/genres/anime`),
};

export function bestTitle(a: Anime) {
  return a.title_english || a.title;
}