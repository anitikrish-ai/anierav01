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