import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AdminCard, AdminHeader } from "@/components/admin/AdminShell";
import { exportBackup, restoreBackup } from "@/lib/backup.functions";
import { downloadText } from "@/lib/listFormats";

export const Route = createFileRoute("/_authenticated/admin/backup")({
  head: () => ({
    meta: [
      { title: "Backup & Restore — AniEra Admin" },
      { name: "description", content: "Export and restore AniEra site configuration." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BackupPage,
});

function BackupPage() {
  const doExport = useServerFn(exportBackup);
  const doRestore = useServerFn(restoreBackup);
  const [preview, setPreview] = useState<string | null>(null);

  const exportMut = useMutation({
    mutationFn: () => doExport(),
    onSuccess: (data: any) => {
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      downloadText(`aniera-backup-${stamp}.json`, JSON.stringify(data, null, 2), "application/json");
      setPreview(JSON.stringify(data, null, 2).slice(0, 4000));
      toast.success("Backup downloaded");
    },
    onError: (e: any) => toast.error(e?.message ?? "Export failed"),
  });

  const restoreMut = useMutation({
    mutationFn: async (file: File) => {
      const parsed = JSON.parse(await file.text());
      return doRestore({ data: parsed });
    },
    onSuccess: (r: any) =>
      toast.success(`Restored — ${r.providers} providers, ${r.seo} SEO overrides`),
    onError: (e: any) => toast.error(e?.message ?? "Restore failed"),
  });

  return (
    <>
      <AdminHeader
        title="Backup & Restore"
        description="Download a JSON snapshot of your site settings, API providers and SEO overrides — or restore one."
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <AdminCard>
          <h2 className="font-display text-lg font-bold text-white">Export</h2>
          <p className="mt-1 text-sm text-white/60">
            Creates a portable JSON file. Keep it somewhere safe before making big changes.
          </p>
          <button
            onClick={() => exportMut.mutate()}
            disabled={exportMut.isPending}
            className="mt-4 rounded-lg bg-gradient-to-r from-neon-cyan to-neon-magenta px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
          >
            {exportMut.isPending ? "Preparing…" : "Download backup"}
          </button>
        </AdminCard>

        <AdminCard>
          <h2 className="font-display text-lg font-bold text-white">Restore</h2>
          <p className="mt-1 text-sm text-white/60">
            Replaces API providers and merges SEO overrides and site settings. This cannot be undone.
          </p>
          <label className="mt-4 inline-block cursor-pointer rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20">
            {restoreMut.isPending ? "Restoring…" : "Choose backup file"}
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f && confirm("Restore this backup? Existing providers will be replaced.")) {
                  restoreMut.mutate(f);
                }
                e.target.value = "";
              }}
            />
          </label>
        </AdminCard>
      </div>

      {preview && (
        <AdminCard className="mt-5">
          <h3 className="font-display text-sm font-bold text-white">Last export preview</h3>
          <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-black/40 p-3 text-[11px] text-white/70">
            {preview}
          </pre>
        </AdminCard>
      )}
    </>
  );
}
