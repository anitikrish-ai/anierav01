export interface HistoryEntry {
  malId: number;
  title: string;
  image: string;
  episode: number;
  totalEpisodes: number | null;
  lang: "sub" | "dub";
  updatedAt: number;
}

const KEY = "aniera:history";
const FAV_KEY = "aniera:favorites";
const WATCHED_KEY = "aniera:watched";

export function getHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch { return []; }
}

export function saveHistory(entry: HistoryEntry) {
  if (typeof window === "undefined") return;
  const list = getHistory().filter(e => e.malId !== entry.malId);
  list.unshift(entry);
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 30)));
}

export function getFavorites(): number[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || "[]"); } catch { return []; }
}

export function toggleFavorite(id: number): boolean {
  const cur = getFavorites();
  const has = cur.includes(id);
  const next = has ? cur.filter(x => x !== id) : [id, ...cur];
  localStorage.setItem(FAV_KEY, JSON.stringify(next));
  return !has;
}

/** Per-anime set of watched episode numbers (episode bookmarks). */
type WatchedMap = Record<string, number[]>;

function readWatched(): WatchedMap {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(WATCHED_KEY) || "{}"); } catch { return {}; }
}

export function getWatchedEpisodes(malId: number): number[] {
  return readWatched()[String(malId)] ?? [];
}

export function markEpisodeWatched(malId: number, ep: number) {
  if (typeof window === "undefined") return;
  const map = readWatched();
  const key = String(malId);
  const set = new Set(map[key] ?? []);
  set.add(ep);
  map[key] = Array.from(set).sort((a, b) => a - b);
  localStorage.setItem(WATCHED_KEY, JSON.stringify(map));
}

export function toggleEpisodeWatched(malId: number, ep: number): boolean {
  if (typeof window === "undefined") return false;
  const map = readWatched();
  const key = String(malId);
  const set = new Set(map[key] ?? []);
  const has = set.has(ep);
  if (has) set.delete(ep); else set.add(ep);
  map[key] = Array.from(set).sort((a, b) => a - b);
  localStorage.setItem(WATCHED_KEY, JSON.stringify(map));
  return !has;
}

/** Per-episode playback timestamp (seconds) for resume. */
const PROGRESS_KEY = "aniera:progress";
type ProgressMap = Record<string, { t: number; d: number; u: number }>;

function readProgress(): ProgressMap {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}"); } catch { return {}; }
}

export function getEpisodeProgress(malId: number, ep: number): { t: number; d: number } | null {
  const p = readProgress()[`${malId}:${ep}`];
  return p ? { t: p.t, d: p.d } : null;
}

export function saveEpisodeProgress(malId: number, ep: number, t: number, d: number) {
  if (typeof window === "undefined") return;
  const map = readProgress();
  map[`${malId}:${ep}`] = { t, d, u: Date.now() };
  // Keep the map bounded
  const keys = Object.keys(map);
  if (keys.length > 500) {
    const sorted = keys.sort((a, b) => (map[a].u ?? 0) - (map[b].u ?? 0));
    for (const k of sorted.slice(0, keys.length - 500)) delete map[k];
  }
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(map));
}

/** Persist last-used streaming provider per anime. */
const PROVIDER_KEY = "aniera:provider";
export function getPreferredProvider(malId: number): string | null {
  if (typeof window === "undefined") return null;
  try {
    const m = JSON.parse(localStorage.getItem(PROVIDER_KEY) || "{}");
    return m[String(malId)] ?? m.__default ?? null;
  } catch { return null; }
}
export function setPreferredProvider(malId: number, id: string) {
  if (typeof window === "undefined") return;
  try {
    const m = JSON.parse(localStorage.getItem(PROVIDER_KEY) || "{}");
    m[String(malId)] = id;
    m.__default = id;
    localStorage.setItem(PROVIDER_KEY, JSON.stringify(m));
  } catch {}
}

/** Persist last-used language (sub/dub) globally. */
const LANG_KEY = "aniera:lang";
export function getPreferredLang(): "sub" | "dub" {
  if (typeof window === "undefined") return "sub";
  return (localStorage.getItem(LANG_KEY) as "sub" | "dub") || "sub";
}
export function setPreferredLang(l: "sub" | "dub") {
  if (typeof window === "undefined") return;
  localStorage.setItem(LANG_KEY, l);
}