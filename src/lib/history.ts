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