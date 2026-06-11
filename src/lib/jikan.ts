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

async function jget<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error(`Jikan ${r.status}`);
  return r.json();
}

export const jikan = {
  topAiring: (page = 1) => jget<JikanList<Anime>>(`/top/anime?filter=airing&page=${page}`),
  topPopular: (page = 1) => jget<JikanList<Anime>>(`/top/anime?filter=bypopularity&page=${page}`),
  seasonNow: (page = 1) => jget<JikanList<Anime>>(`/seasons/now?page=${page}`),
  seasonUpcoming: (page = 1) => jget<JikanList<Anime>>(`/seasons/upcoming?page=${page}`),
  search: (q: string, page = 1, genres?: string, year?: string) => {
    const params = new URLSearchParams({ q, page: String(page), sfw: "true", limit: "24" });
    if (genres) params.set("genres", genres);
    if (year) params.set("start_date", `${year}-01-01`);
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