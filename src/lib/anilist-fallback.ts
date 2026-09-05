/**
 * AniList fallback layer.
 *
 * Jikan proxies MyAnimeList and goes down whenever MAL does (HTTP 504
 * "Jikan failed to connect to MyAnimeList"). When that happens every data
 * surface in the app would break, so we transparently re-serve the same
 * shapes from AniList's GraphQL API.
 */

import type { Anime, Episode } from "./jikan";

const AL = "https://graphql.anilist.co";

interface AlMedia {
  id: number;
  idMal: number | null;
  title: { romaji: string | null; english: string | null; native: string | null };
  format: string | null;
  episodes: number | null;
  status: string | null;
  averageScore: number | null;
  popularity: number | null;
  favourites: number | null;
  description: string | null;
  seasonYear: number | null;
  season: string | null;
  genres: string[];
  duration: number | null;
  isAdult?: boolean;
  studios?: { nodes: { id: number; name: string }[] };
  trailer?: { id: string | null; site: string | null } | null;
  coverImage: { large: string | null; extraLarge: string | null };
  nextAiringEpisode?: { airingAt: number; episode: number } | null;
  siteUrl?: string | null;
}

const MEDIA_FIELDS = `
  id idMal
  title { romaji english native }
  format episodes status averageScore popularity favourites
  description(asHtml: false)
  seasonYear season genres duration isAdult siteUrl
  studios(isMain: true) { nodes { id name } }
  trailer { id site }
  coverImage { large extraLarge }
  nextAiringEpisode { airingAt episode }
`;

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(AL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`AniList ${res.status}`);
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors[0]!.message);
  if (!json.data) throw new Error("AniList returned no data");
  return json.data;
}

function stripHtml(s: string | null): string | null {
  if (!s) return null;
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const STATUS_MAP: Record<string, string> = {
  RELEASING: "Currently Airing",
  FINISHED: "Finished Airing",
  NOT_YET_RELEASED: "Not yet aired",
  CANCELLED: "Cancelled",
  HIATUS: "On Hiatus",
};

/** Convert an AniList media node into the Jikan `Anime` shape the UI expects. */
export function toAnime(m: AlMedia): Anime {
  const img = m.coverImage.extraLarge || m.coverImage.large || "";
  const large = m.coverImage.extraLarge || img;
  return {
    mal_id: m.idMal ?? m.id,
    url: m.siteUrl ?? `https://anilist.co/anime/${m.id}`,
    images: {
      jpg: { image_url: img, large_image_url: large },
      webp: { image_url: img, large_image_url: large },
    },
    title: m.title.romaji || m.title.english || m.title.native || "Untitled",
    title_english: m.title.english,
    title_japanese: m.title.native,
    type: m.format ? (m.format === "TV" ? "TV" : m.format.replace(/_/g, " ")) : null,
    episodes: m.episodes,
    status: m.status ? (STATUS_MAP[m.status] ?? m.status) : null,
    score: m.averageScore != null ? Math.round(m.averageScore) / 10 : null,
    scored_by: m.favourites ?? null,
    rank: null,
    popularity: m.popularity ?? null,
    synopsis: stripHtml(m.description),
    year: m.seasonYear,
    season: m.season ? m.season.toLowerCase() : null,
    genres: m.genres.map((g, i) => ({ mal_id: i, name: g })),
    studios: m.studios?.nodes?.map(s => ({ mal_id: s.id, name: s.name })) ?? [],
    duration: m.duration ? `${m.duration} min per ep` : null,
    rating: m.isAdult ? "R+" : null,
    trailer:
      m.trailer?.site === "youtube" && m.trailer.id
        ? {
            youtube_id: m.trailer.id,
            url: `https://www.youtube.com/watch?v=${m.trailer.id}`,
            embed_url: `https://www.youtube.com/embed/${m.trailer.id}`,
          }
        : undefined,
    // Extra field consumed by the schedule page for broadcast time.
    ...(m.nextAiringEpisode
      ? {
          broadcast: {
            time: new Date(m.nextAiringEpisode.airingAt * 1000).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
        }
      : {}),
  } as Anime;
}

type List = { data: Anime[]; pagination: { has_next_page: boolean; current_page: number; last_visible_page: number } };

function list(media: AlMedia[], page: number, hasNext: boolean): List {
  return {
    data: media.map(toAnime),
    pagination: { has_next_page: hasNext, current_page: page, last_visible_page: hasNext ? page + 1 : page },
  };
}

interface PageResp {
  Page: { pageInfo: { hasNextPage: boolean }; media: AlMedia[] };
}

const VAR_TYPES: Record<string, string> = {
  page: "Int",
  perPage: "Int",
  search: "String",
  season: "MediaSeason",
  seasonYear: "Int",
  genreIn: "[String]",
  scoreGreater: "Int",
};


async function page(
  vars: Record<string, unknown>,
  filter: string,
  perPage = 24,
): Promise<PageResp> {
  const all = { perPage, ...vars };
  // GraphQL rejects declared-but-unused variables, so declare only what's set.
  const used = Object.entries(all).filter(([, v]) => v !== undefined);
  const decl = used.map(([k]) => `$${k}: ${VAR_TYPES[k] ?? "String"}`).join(", ");
  const query = `query (${decl}) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { hasNextPage }
      media(type: ANIME, isAdult: false, ${filter}) { ${MEDIA_FIELDS} }
    }
  }`;
  return gql<PageResp>(query, Object.fromEntries(used));
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function currentSeason(d = new Date()): { season: string; year: number } {
  const m = d.getMonth();
  const season = m < 3 ? "WINTER" : m < 6 ? "SPRING" : m < 9 ? "SUMMER" : "FALL";
  return { season, year: d.getFullYear() };
}

function nextSeason(): { season: string; year: number } {
  const { season, year } = currentSeason();
  const order = ["WINTER", "SPRING", "SUMMER", "FALL"];
  const i = order.indexOf(season);
  return i === 3 ? { season: "WINTER", year: year + 1 } : { season: order[i + 1]!, year };
}

/**
 * MAL genre ids are what the UI sends; AniList filters by genre *name*.
 * Jikan's /genres/anime endpoint stays up even when MAL search is down, so
 * use it as the source of truth and fall back to a static map.
 */
const STATIC_GENRES: Record<string, string> = {
  "1": "Action", "2": "Adventure", "4": "Comedy", "5": "Slice of Life", "7": "Mystery",
  "8": "Drama", "9": "Ecchi", "10": "Fantasy", "14": "Horror", "17": "Martial Arts",
  "18": "Mecha", "19": "Music", "22": "Romance", "23": "School", "24": "Sci-Fi",
  "25": "Shoujo", "26": "Girls Love", "27": "Shounen", "28": "Boys Love", "29": "Space",
  "30": "Sports", "31": "Super Power", "32": "Vampire", "35": "Harem",
  "36": "Slice of Life", "37": "Supernatural", "38": "Military", "39": "Police",
  "40": "Psychological", "41": "Thriller", "42": "Seinen", "43": "Josei",
};

let genreMapPromise: Promise<Record<string, string>> | null = null;

async function genreMap(): Promise<Record<string, string>> {
  if (!genreMapPromise) {
    genreMapPromise = (async () => {
      try {
        const res = await fetch("https://api.jikan.moe/v4/genres/anime", {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { data: { mal_id: number; name: string }[] };
        const out: Record<string, string> = { ...STATIC_GENRES };
        for (const g of json.data ?? []) out[String(g.mal_id)] = g.name;
        return out;
      } catch {
        return STATIC_GENRES;
      }
    })();
  }
  return genreMapPromise;
}

async function malGenreName(value: string): Promise<string | undefined> {
  if (!/^\d+$/.test(value)) return value; // already a name
  return (await genreMap())[value];
}

/**
 * Serve a Jikan path from AniList. Returns null when the path has no
 * sensible AniList equivalent, so the caller can surface the original error.
 */
export async function anilistFallback(path: string): Promise<unknown | null> {
  const [rawPath, rawQuery = ""] = path.split("?");
  const p = rawPath!;
  const sp = new URLSearchParams(rawQuery);
  const pageNum = Number(sp.get("page") || 1);

  // /top/anime?filter=airing|bypopularity|(none)
  if (p === "/top/anime") {
    const f = sp.get("filter");
    const sort =
      f === "airing" ? "status: RELEASING, sort: TRENDING_DESC" :
      f === "bypopularity" ? "sort: POPULARITY_DESC" :
      "sort: SCORE_DESC";
    const r = await page({ page: pageNum }, sort, 25);
    return list(r.Page.media, pageNum, r.Page.pageInfo.hasNextPage);
  }

  // /seasons/now, /seasons/upcoming
  if (p === "/seasons/now" || p === "/seasons/upcoming") {
    const s = p.endsWith("now") ? currentSeason() : nextSeason();
    const r = await page(
      { page: pageNum, season: s.season, seasonYear: s.year },
      "season: $season, seasonYear: $seasonYear, sort: POPULARITY_DESC",
      25,
    );
    return list(r.Page.media, pageNum, r.Page.pageInfo.hasNextPage);
  }

  // /schedules?filter=<weekday>
  if (p === "/schedules") {
    const day = sp.get("filter");
    // Pull a deeper slice so each weekday has a full line-up, not 3 shows.
    const pages = await Promise.all(
      [1, 2, 3].map(n =>
        page({ page: n }, "status: RELEASING, sort: POPULARITY_DESC", 50).catch(() => null),
      ),
    );
    let media = pages
      .flatMap(r => r?.Page.media ?? [])
      .filter(m => m.nextAiringEpisode);
    if (day) {
      media = media.filter(m => {
        const d = new Date(m.nextAiringEpisode!.airingAt * 1000);
        return WEEKDAYS[d.getDay()] === day.toLowerCase();
      });
    }
    media.sort((a, b) => a.nextAiringEpisode!.airingAt - b.nextAiringEpisode!.airingAt);
    return list(media, 1, false);
  }

  // /anime?q=...&genres=&status=&type=&start_date=
  if (p === "/anime") {
    const q = sp.get("q");
    const status = sp.get("status");
    const type = sp.get("type");
    const startDate = sp.get("start_date");
    const parts: string[] = [];
    if (q) parts.push("search: $search");
    if (startDate) parts.push("seasonYear: $seasonYear");
    if (status) {
      const map: Record<string, string> = { airing: "RELEASING", complete: "FINISHED", upcoming: "NOT_YET_RELEASED" };
      if (map[status]) parts.push(`status: ${map[status]}`);
    }
    if (type) parts.push(`format: ${type.toUpperCase().replace(/\s+/g, "_")}`);
    const genreIds = (sp.get("genres") ?? "").split(",").filter(Boolean);
    const genreNames = (await Promise.all(genreIds.map(malGenreName))).filter(Boolean) as string[];
    if (genreNames.length) parts.push("genre_in: $genreIn");
    const minScore = Number(sp.get("min_score"));
    if (Number.isFinite(minScore) && minScore > 0) parts.push("averageScore_greater: $scoreGreater");
    const ORDER: Record<string, string> = {
      score: "SCORE_DESC",
      popularity: "POPULARITY_DESC",
      start_date: "START_DATE_DESC",
      title: "TITLE_ROMAJI",
      episodes: "EPISODES_DESC",
    };
    const orderBy = sp.get("order_by");
    parts.push(
      orderBy && ORDER[orderBy]
        ? `sort: ${ORDER[orderBy]}`
        : q
          ? "sort: SEARCH_MATCH"
          : "sort: POPULARITY_DESC",
    );
    const r = await page(
      {
        page: pageNum,
        search: q || undefined,
        seasonYear: startDate ? Number(startDate.slice(0, 4)) : undefined,
        genreIn: genreNames.length ? genreNames : undefined,
        scoreGreater: Number.isFinite(minScore) && minScore > 0 ? Math.round(minScore * 10) : undefined,
      },
      parts.join(", "),
      Number(sp.get("limit") || 24),
    );
    return list(r.Page.media, pageNum, r.Page.pageInfo.hasNextPage);

  }


  // /anime/{id}/full
  const full = p.match(/^\/anime\/(\d+)\/full$/);
  if (full) {
    const data = await gql<{ Media: AlMedia | null }>(
      `query ($idMal: Int) { Media(idMal: $idMal, type: ANIME) { ${MEDIA_FIELDS} } }`,
      { idMal: Number(full[1]) },
    );
    if (!data.Media) return null;
    return { data: toAnime(data.Media) };
  }

  // /anime/{id}/episodes — AniList has no per-episode titles, so synthesise.
  const eps = p.match(/^\/anime\/(\d+)\/episodes$/);
  if (eps) {
    const data = await gql<{ Media: AlMedia | null }>(
      `query ($idMal: Int) { Media(idMal: $idMal, type: ANIME) { episodes nextAiringEpisode { episode } } }`,
      { idMal: Number(eps[1]) },
    );
    const total =
      data.Media?.episodes ??
      (data.Media?.nextAiringEpisode ? data.Media.nextAiringEpisode.episode - 1 : 0);
    const out: Episode[] = Array.from({ length: Math.max(0, total) }, (_, i) => ({
      mal_id: i + 1,
      title: `Episode ${i + 1}`,
    }));
    return { data: out, pagination: { has_next_page: false, current_page: 1, last_visible_page: 1 } };
  }

  // /anime/{id}/recommendations
  const recs = p.match(/^\/anime\/(\d+)\/recommendations$/);
  if (recs) {
    const data = await gql<{ Media: { recommendations: { nodes: { mediaRecommendation: AlMedia | null }[] } } | null }>(
      `query ($idMal: Int) {
        Media(idMal: $idMal, type: ANIME) {
          recommendations(sort: RATING_DESC, perPage: 12) {
            nodes { mediaRecommendation { ${MEDIA_FIELDS} } }
          }
        }
      }`,
      { idMal: Number(recs[1]) },
    );
    const nodes = data.Media?.recommendations?.nodes ?? [];
    return {
      data: nodes
        .filter(n => n.mediaRecommendation)
        .map(n => ({ entry: toAnime(n.mediaRecommendation!) })),
    };
  }

  // /anime/{id}/relations
  const rels = p.match(/^\/anime\/(\d+)\/relations$/);
  if (rels) {
    const data = await gql<{
      Media: {
        relations: {
          edges: {
            relationType: string | null;
            node: { id: number; idMal: number | null; type: string | null; format: string | null; siteUrl: string | null; title: { romaji: string | null; english: string | null } };
          }[];
        } | null;
      } | null;
    }>(
      `query ($idMal: Int) {
        Media(idMal: $idMal, type: ANIME) {
          relations {
            edges {
              relationType(version: 2)
              node { id idMal type format siteUrl title { romaji english } }
            }
          }
        }
      }`,
      { idMal: Number(rels[1]) },
    );
    const edges = data.Media?.relations?.edges ?? [];
    const grouped = new Map<string, { mal_id: number; type: string; name: string; url: string }[]>();
    for (const e of edges) {
      if (!e.node.idMal || e.node.type !== "ANIME") continue;
      const rel = (e.relationType ?? "OTHER")
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/\b\w/g, c => c.toUpperCase());
      const entry = {
        mal_id: e.node.idMal,
        type: "anime",
        name: e.node.title.english || e.node.title.romaji || "Untitled",
        url: e.node.siteUrl ?? `https://anilist.co/anime/${e.node.id}`,
      };
      grouped.set(rel, [...(grouped.get(rel) ?? []), entry]);
    }
    return { data: [...grouped].map(([relation, entry]) => ({ relation, entry })) };
  }

  // /genres/anime

  if (p === "/genres/anime") {
    const data = await gql<{ GenreCollection: string[] }>(`query { GenreCollection }`, {});
    return {
      data: (data.GenreCollection ?? []).map((name, i) => ({ mal_id: i + 1, name, count: 0 })),
    };
  }

  return null;
}
