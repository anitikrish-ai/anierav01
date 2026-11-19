import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getMyProfile,
  updateMyProfile,
  importFromMal,
  bulkUpsert,
  listLibrary,
} from "@/lib/library.functions";
import {
  exportJSON,
  exportMAL,
  exportCSV,
  parseListFile,
  downloadText,
  type LibEntry,
} from "@/lib/listFormats";
import { ErrorState } from "@/components/StateBlocks";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { name: "description", content: "Manage your AniEra account and profile preferences." },
      { property: "og:title", content: "Profile — AniEra" },
      {
        property: "og:description",
        content: "Manage your AniEra account and profile preferences.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Profile — AniEra" },
    ],
  }),
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
    mutationFn: () =>
      saveProfile({
        data: {
          display_name: displayName.trim() || null,
          mal_username: malUsername.trim() || null,
        } as any,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile saved.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  const importMalMut = useMutation({
    mutationFn: (username: string) => importMal({ data: { username } }),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["library"] });
      toast.success(`Imported ${r.inserted} entries from MAL.`);
    },
    onError: (e: any) => toast.error(e?.message ?? "MAL import failed"),
  });

  const importFileMut = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const entries: LibEntry[] = parseListFile(text);
      if (!entries.length) throw new Error("No valid entries found in file");
      return bulk({ data: { entries } as any });
    },
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["library"] });
      toast.success(`Imported ${r.inserted} entries.`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Import failed"),
  });

  const entries: LibEntry[] = (libQ.data ?? []).map((r: any) => ({
    mal_id: r.mal_id,
    title: r.title,
    image: r.image,
    status: r.status,
    score: r.score,
    episodes_watched: r.episodes_watched,
    total_episodes: r.total_episodes,
    is_favorite: r.is_favorite,
    notes: r.notes,
  }));

  const download = (fmt: "json" | "xml" | "csv") => {
    const stamp = new Date().toISOString().slice(0, 10);
    if (!entries.length) {
      toast.info("Your library is empty.");
      return;
    }
    if (fmt === "json")
      downloadText(`aniera-${stamp}.json`, exportJSON(entries), "application/json");
    if (fmt === "xml")
      downloadText(`animelist-${stamp}.xml`, exportMAL(entries), "application/xml");
    if (fmt === "csv") downloadText(`aniera-${stamp}.csv`, exportCSV(entries), "text/csv");
  };

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="page-enter mx-auto max-w-3xl space-y-6 py-4 sm:space-y-8 sm:py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Profile</h1>
          <p className="mt-0.5 text-sm text-white/60">
            Account identity, MyAnimeList sync, and portable library backups.
          </p>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="min-h-[44px] rounded-xl glass px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
        >
          Sign out
        </button>
      </header>

      {profileQ.isError && (
        <ErrorState
          message={(profileQ.error as Error)?.message}
          onRetry={() => profileQ.refetch()}
          retrying={profileQ.isFetching}
        />
      )}

      <section className="apple-group space-y-4 rounded-3xl p-5 sm:p-6">
        <div className="border-b border-white/10 pb-3">
          <h2 className="font-display text-lg font-bold text-white">Account</h2>
          <p className="mt-0.5 text-xs text-white/55">
            Configure your public review name and linked MyAnimeList handle.
          </p>
        </div>

        {profileQ.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="h-16 rounded-xl shimmer" />
            <div className="h-16 rounded-xl shimmer" />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <label
                  htmlFor="profile-display-name"
                  className="text-xs font-semibold uppercase tracking-wider text-white/70"
                >
                  Display Name
                </label>
                <span className="text-[11px] tabular-nums text-white/45">
                  {displayName.length}/80
                </span>
              </div>
              <input
                id="profile-display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={80}
                placeholder="Your display name"
                className="min-h-[44px] w-full rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25"
              />
              <p className="text-[11px] text-white/50">Shown next to reviews you publish.</p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <label
                  htmlFor="profile-mal-username"
                  className="text-xs font-semibold uppercase tracking-wider text-white/70"
                >
                  MyAnimeList Username
                </label>
                <span className="text-[11px] tabular-nums text-white/45">
                  {malUsername.length}/30
                </span>
              </div>
              <input
                id="profile-mal-username"
                value={malUsername}
                onChange={(e) => setMalUsername(e.target.value)}
                maxLength={30}
                placeholder="e.g. yourname"
                className="min-h-[44px] w-full rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25"
              />
              <p className="text-[11px] text-white/50">
                Used to import your public MyAnimeList catalogue.
              </p>
            </div>
          </div>
        )}

        <div className="border-t border-white/10 pt-3 flex justify-end">
          <button
            type="button"
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || profileQ.isLoading}
            className="min-h-[44px] rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-45"
          >
            {saveMut.isPending ? "Saving…" : "Save Profile"}
          </button>
        </div>
      </section>

      <section className="apple-group space-y-4 rounded-3xl p-5 sm:p-6">
        <div className="border-b border-white/10 pb-3">
          <h2 className="font-display text-lg font-bold text-white">Import from MyAnimeList</h2>
          <p className="mt-0.5 text-xs text-white/55">
            Pulls your public anime list via Jikan and merges it into your AniEra library.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-white/50">
            {malUsername.trim()
              ? `Ready to sync public entries for "${malUsername.trim()}"`
              : "Set a MyAnimeList username in Account above first"}
          </span>
          <button
            type="button"
            onClick={() =>
              malUsername.trim()
                ? importMalMut.mutate(malUsername.trim())
                : toast.error("Set a MAL username first")
            }
            disabled={importMalMut.isPending}
            className="min-h-[44px] rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-45"
          >
            {importMalMut.isPending
              ? "Importing…"
              : `Import from MAL${malUsername ? ` (${malUsername})` : ""}`}
          </button>
        </div>
      </section>

      <section className="apple-group space-y-4 rounded-3xl p-5 sm:p-6">
        <div className="border-b border-white/10 pb-3">
          <h2 className="font-display text-lg font-bold text-white">Import / Export List</h2>
          <p className="mt-0.5 text-xs text-white/55">
            Accepts .json, .xml (MAL), or .csv exports. Format is auto-detected on upload.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <label className="inline-flex min-h-[44px] cursor-pointer items-center rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:bg-primary/90">
            {importFileMut.isPending ? "Importing…" : "Import File"}
            <input
              type="file"
              accept=".json,.xml,.csv,.txt,application/json,application/xml,text/csv,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importFileMut.mutate(f);
                e.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => download("json")}
            className="min-h-[44px] rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={() => download("xml")}
            className="min-h-[44px] rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Export MAL XML
          </button>
          <button
            type="button"
            onClick={() => download("csv")}
            className="min-h-[44px] rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Export CSV
          </button>
        </div>
        <p className="border-t border-white/10 pt-3 text-xs text-white/50">
          {libQ.isLoading
            ? "Loading library summary…"
            : libQ.isError
              ? "Could not load library summary."
              : `Library currently contains ${entries.length} ${entries.length === 1 ? "entry" : "entries"}.`}
        </p>
      </section>
    </div>
  );
}
