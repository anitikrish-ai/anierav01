export type LibStatus = "watching" | "completed" | "plan_to_watch" | "on_hold" | "dropped";

export interface LibEntry {
  mal_id: number;
  title: string;
  image?: string | null;
  status: LibStatus;
  score?: number | null;
  episodes_watched: number;
  total_episodes?: number | null;
  is_favorite: boolean;
  notes?: string | null;
}

const STATUS_TO_MAL: Record<LibStatus, number> = {
  watching: 1,
  completed: 2,
  on_hold: 3,
  dropped: 4,
  plan_to_watch: 6,
};
const MAL_TO_STATUS: Record<string, LibStatus> = {
  "1": "watching", "2": "completed", "3": "on_hold", "4": "dropped", "6": "plan_to_watch",
  watching: "watching", completed: "completed", on_hold: "on_hold", dropped: "dropped",
  plan_to_watch: "plan_to_watch", plantowatch: "plan_to_watch", planned: "plan_to_watch",
  onhold: "on_hold", paused: "on_hold",
};

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
}

/** Native JSON export (most lossless). */
export function exportJSON(entries: LibEntry[]): string {
  return JSON.stringify({ app: "AniEra", version: 1, exported_at: new Date().toISOString(), entries }, null, 2);
}

/** MyAnimeList XML export — compatible with MAL importer. */
export function exportMAL(entries: LibEntry[]): string {
  const lines: string[] = [
    `<?xml version="1.0" encoding="UTF-8" ?>`,
    `<myanimelist>`,
    `  <myinfo>`,
    `    <user_export_type>1</user_export_type>`,
    `    <user_total_anime>${entries.length}</user_total_anime>`,
    `  </myinfo>`,
  ];
  for (const e of entries) {
    lines.push(
      `  <anime>`,
      `    <series_animedb_id>${e.mal_id}</series_animedb_id>`,
      `    <series_title><![CDATA[${e.title}]]></series_title>`,
      `    <series_episodes>${e.total_episodes ?? 0}</series_episodes>`,
      `    <my_watched_episodes>${e.episodes_watched}</my_watched_episodes>`,
      `    <my_score>${e.score ?? 0}</my_score>`,
      `    <my_status>${STATUS_TO_MAL[e.status]}</my_status>`,
      `    <my_times_watched>0</my_times_watched>`,
      `    <my_comments><![CDATA[${e.notes ?? ""}]]></my_comments>`,
      `    <update_on_import>1</update_on_import>`,
      `  </anime>`,
    );
  }
  lines.push(`</myanimelist>`);
  return lines.join("\n");
}

/** CSV export (Excel-friendly). */
export function exportCSV(entries: LibEntry[]): string {
  const head = ["mal_id", "title", "status", "score", "episodes_watched", "total_episodes", "is_favorite", "notes"];
  const rows = entries.map(e => [
    e.mal_id, e.title, e.status, e.score ?? "", e.episodes_watched, e.total_episodes ?? "", e.is_favorite ? "1" : "0", (e.notes ?? "").replace(/\n/g, " "),
  ]);
  const csv = [head, ...rows]
    .map(r => r.map(v => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(","))
    .join("\n");
  return csv;
}

function detectFormat(text: string): "json" | "xml" | "csv" {
  const t = text.trim();
  if (t.startsWith("<")) return "xml";
  if (t.startsWith("{") || t.startsWith("[")) return "json";
  return "csv";
}

function normStatus(v: unknown): LibStatus {
  const key = String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return MAL_TO_STATUS[key] ?? "plan_to_watch";
}

function parseJSON(text: string): LibEntry[] {
  const j = JSON.parse(text);
  const arr: any[] = Array.isArray(j) ? j : j.entries ?? j.lists ?? j.data ?? [];
  return arr
    .map(r => {
      const malId = Number(r.mal_id ?? r.malId ?? r.id ?? r.idMal ?? r.media?.idMal);
      if (!malId) return null;
      return {
        mal_id: malId,
        title: String(r.title ?? r.media?.title?.romaji ?? r.media?.title?.english ?? `Anime ${malId}`),
        image: r.image ?? r.media?.coverImage?.large ?? null,
        status: normStatus(r.status),
        score: r.score != null ? Number(r.score) || null : null,
        episodes_watched: Number(r.episodes_watched ?? r.progress ?? 0) || 0,
        total_episodes: r.total_episodes != null ? Number(r.total_episodes) || null : null,
        is_favorite: !!(r.is_favorite ?? r.favorite),
        notes: r.notes ?? r.comments ?? null,
      } satisfies LibEntry;
    })
    .filter(Boolean) as LibEntry[];
}

function parseCSV(text: string): LibEntry[] {
  const rows: string[][] = [];
  let cur: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { cur.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (cell || cur.length) { cur.push(cell); rows.push(cur); cur = []; cell = ""; } if (c === "\r" && text[i + 1] === "\n") i++; }
    else cell += c;
  }
  if (cell || cur.length) { cur.push(cell); rows.push(cur); }
  if (rows.length < 2) return [];
  const head = rows[0].map(h => h.trim().toLowerCase());
  const idx = (k: string) => head.indexOf(k);
  return rows.slice(1).map(r => {
    const malId = Number(r[idx("mal_id")] ?? r[idx("id")]);
    if (!malId) return null;
    return {
      mal_id: malId,
      title: r[idx("title")] ?? `Anime ${malId}`,
      image: null,
      status: normStatus(r[idx("status")]),
      score: Number(r[idx("score")]) || null,
      episodes_watched: Number(r[idx("episodes_watched")] ?? r[idx("progress")]) || 0,
      total_episodes: Number(r[idx("total_episodes")]) || null,
      is_favorite: r[idx("is_favorite")] === "1" || r[idx("is_favorite")]?.toLowerCase() === "true",
      notes: r[idx("notes")] || null,
    } satisfies LibEntry;
  }).filter(Boolean) as LibEntry[];
}

function parseXML(text: string): LibEntry[] {
  const out: LibEntry[] = [];
  const blocks = text.match(/<anime>[\s\S]*?<\/anime>/g) ?? [];
  const get = (b: string, tag: string) => {
    const m = b.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`));
    return m ? m[1].trim() : "";
  };
  for (const b of blocks) {
    const malId = Number(get(b, "series_animedb_id"));
    if (!malId) continue;
    out.push({
      mal_id: malId,
      title: get(b, "series_title") || `Anime ${malId}`,
      image: null,
      status: normStatus(get(b, "my_status")),
      score: Number(get(b, "my_score")) || null,
      episodes_watched: Number(get(b, "my_watched_episodes")) || 0,
      total_episodes: Number(get(b, "series_episodes")) || null,
      is_favorite: false,
      notes: get(b, "my_comments") || null,
    });
  }
  return out;
}

/** Auto-detects JSON / XML (MAL) / CSV. */
export function parseListFile(text: string): LibEntry[] {
  const fmt = detectFormat(text);
  if (fmt === "json") return parseJSON(text);
  if (fmt === "xml") return parseXML(text);
  return parseCSV(text);
}

// Helper: trigger a browser download
export function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// keep esc referenced so unused-import linter stays quiet
void esc;