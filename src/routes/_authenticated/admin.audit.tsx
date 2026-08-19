import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AdminCard, AdminHeader } from "@/components/admin/AdminShell";
import { listAudit, clearAudit } from "@/lib/audit.functions";
import { EmptyState, ErrorState } from "@/components/StateBlocks";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({
    meta: [
      { title: "Audit Trail — AniEra Admin" },
      { name: "description", content: "Review recent administrator activity on AniEra." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuditPage,
});

function AuditPage() {
  const fetchAudit = useServerFn(listAudit);
  const clear = useServerFn(clearAudit);
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");

  const q = useQuery({ queryKey: ["audit-log"], queryFn: () => fetchAudit(), retry: false });

  const clearMut = useMutation({
    mutationFn: (olderThanDays: number) => clear({ data: { olderThanDays } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["audit-log"] });
      toast.success("Audit trail pruned");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not clear the log"),
  });

  const rows = ((q.data as any[]) ?? []).filter(r => {
    if (!filter.trim()) return true;
    const hay = `${r.action} ${r.area} ${r.actor_email ?? ""} ${r.target_id ?? ""}`.toLowerCase();
    return hay.includes(filter.trim().toLowerCase());
  });

  return (
    <>
      <AdminHeader
        title="Audit Trail"
        description="Every configuration change made through the admin CMS, newest first."
        actions={
          <div className="flex gap-2">
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Filter…"
              className="rounded-lg bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none"
            />
            <button
              onClick={() => {
                if (confirm("Delete audit entries older than 30 days?")) clearMut.mutate(30);
              }}
              disabled={clearMut.isPending}
              className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20 disabled:opacity-50"
            >
              Prune 30d+
            </button>
          </div>
        }
      />

      {q.isLoading ? (
        <div className="h-64 rounded-2xl shimmer" />
      ) : q.error ? (
        <ErrorState
          message={(q.error as any)?.message}
          onRetry={() => q.refetch()}
          retrying={q.isFetching}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title={filter ? "No matching entries" : "No activity yet"}
          hint={
            filter
              ? "Try a different search term."
              : "Admin actions like backups and restores will show up here."
          }
        />
      ) : (
        <AdminCard className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-white/50">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Who</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Area</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="text-white/80">
              {rows.map(r => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="whitespace-nowrap px-4 py-3 text-white/60">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">{r.actor_email ?? r.actor_id?.slice(0, 8) ?? "—"}</td>
                  <td className="px-4 py-3 font-medium text-white">{r.action}</td>
                  <td className="px-4 py-3">{r.area}</td>
                  <td className="max-w-[240px] truncate px-4 py-3 text-white/50">
                    {r.target_id ? `${r.target_id} · ` : ""}
                    {JSON.stringify(r.details ?? {})}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminCard>
      )}
    </>
  );
}
