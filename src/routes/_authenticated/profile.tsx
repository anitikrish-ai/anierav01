import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile, updateMyProfile, importFromMal, bulkUpsert, listLibrary } from "@/lib/library.functions";
import { exportJSON, exportMAL, exportCSV, parseListFile, downloadText, type LibEntry } from "@/lib/listFormats";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — AniEra" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const fetchProfile = useServerFn(getMyProfile);
  const fetchLibrary = useServerFn(listLibrary);
  const saveProfile = useServerFn(updateMyProfile);
  const importMal = useServerFn(importFromMal);
  const bulk = useServerFn(bulkUpsert);

  const profileQ = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const libQ = useQuery({ queryKey: ["library"], queryFn: () => fetchLibrary() });

  const [displayName, setDisplayName] = useState("");
  const [malUsername, setMalUsername] = useState("");

  useEffect(() => {
    if (profileQ.data) {
      setDisplayName(profileQ.data.display_name ?? "");
      setMalUsername(profileQ.data.mal_username ?? "");
    }
  }, [profileQ.data]);

  const saveMut = useMutation({
    mutationFn: () => saveProfile({ data: {
      display_name: displayName.trim() || null,
      mal_username: malUsername.trim() || null,
    } as any }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profile"] }); toast.success("Profile saved."); },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  const importMalMut = useMutation({
    mutationFn: (username: string) => importMal({ data: { username } }),
    onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ["library"] }); toast.success(`Imported ${r.inserted} entries from MAL.`); },
    onError: (e: any) => toast.error(e?.message ?? "MAL import failed"),
  });

  const importFileMut = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const entries: LibEntry[] = parseListFile(text);
      if (!entries.length) throw new Error("No valid entries found in file");
      return bulk({ data: { entries } as any });
    },
    onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ["library"] }); toast.success(`Imported ${r.inserted} entries.`); },
    onError: (e: any) => toast.error(e?.message ?? "Import failed"),
  });

  const entries: LibEntry[] = (libQ.data ?? []).map((r: any) => ({
    mal_id: r.mal_id, title: r.title, image: r.image, status: r.status,
    score: r.score, episodes_watched: r.episodes_watched, total_episodes: r.total_episodes,
    is_favorite: r.is_favorite, notes: r.notes,
  }));

  const download = (fmt: "json" | "xml" | "csv") => {
    const stamp = new Date().toISOString().slice(0, 10);
    if (!entries.length) { toast.info("Your library is empty."); return; }
    if (fmt === "json") downloadText(`aniera-${stamp}.json`, exportJSON(entries), "application/json");
    if (fmt === "xml") downloadText(`animelist-${stamp}.xml`, exportMAL(entries), "application/xml");
    if (fmt === "csv") downloadText(`aniera-${stamp}.csv`, exportCSV(entries), "text/csv");
  };

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold text-white">Profile</h1>
        <button onClick={signOut} className="rounded-lg glass px-4 py-2 text-sm font-medium text-white hover:bg-white/10">
          Sign out
        </button>
      </header>

      <section className="glass-strong space-y-4 rounded-2xl p-6">
        <h2 className="font-display text-lg font-bold text-white">Account</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs text-white/60">Display name</span>
            <input
              value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={80}
              className="w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-neon-cyan"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-white/60">MyAnimeList username</span>
            <input
              value={malUsername} onChange={e => setMalUsername(e.target.value)} maxLength={30}
              placeholder="e.g. yourname"
              className="w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-neon-cyan"
            />
          </label>
        </div>
        <button
          onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
          className="rounded-lg bg-gradient-to-r from-neon-cyan to-neon-magenta px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
        >
          {saveMut.isPending ? "Saving…" : "Save profile"}
        </button>
      </section>

      <section className="glass-strong space-y-4 rounded-2xl p-6">
        <h2 className="font-display text-lg font-bold text-white">Import from MyAnimeList</h2>
        <p className="text-sm text-white/60">Pulls your public anime list via Jikan and merges it into your AniEra library.</p>
        <button
          onClick={() => malUsername.trim() ? importMalMut.mutate(malUsername.trim()) : toast.error("Set a MAL username first")}
          disabled={importMalMut.isPending}
          className="rounded-lg glass px-4 py-2 text-sm font-medium text-white hover:bg-white/10 disabled:opacity-50"
        >
          {importMalMut.isPending ? "Importing…" : `Import from MAL${malUsername ? ` (${malUsername})` : ""}`}
        </button>
      </section>

      <section className="glass-strong space-y-4 rounded-2xl p-6">
        <h2 className="font-display text-lg font-bold text-white">Import / Export list</h2>
        <p className="text-sm text-white/60">
          Drop a file in JSON, MAL XML, or CSV. Auto-detected on upload.
        </p>
        <div className="flex flex-wrap gap-2">
          <label className="cursor-pointer rounded-lg bg-gradient-to-r from-neon-cyan to-neon-magenta px-4 py-2 text-sm font-semibold text-background">
            {importFileMut.isPending ? "Importing…" : "Import file"}
            <input
              type="file" accept=".json,.xml,.csv,.txt,application/json,application/xml,text/csv,text/plain"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) importFileMut.mutate(f); e.target.value = ""; }}
            />
          </label>
          <button onClick={() => download("json")} className="rounded-lg glass px-4 py-2 text-sm font-medium text-white hover:bg-white/10">Export JSON</button>
          <button onClick={() => download("xml")} className="rounded-lg glass px-4 py-2 text-sm font-medium text-white hover:bg-white/10">Export MAL XML</button>
          <button onClick={() => download("csv")} className="rounded-lg glass px-4 py-2 text-sm font-medium text-white hover:bg-white/10">Export CSV</button>
        </div>
        <p className="text-xs text-white/40">Library currently contains {entries.length} {entries.length === 1 ? "entry" : "entries"}.</p>
      </section>
    </div>
  );
}