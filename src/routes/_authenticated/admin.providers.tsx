import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Activity, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  saveProvider,
  deleteProvider,
  checkProviderHealth,
} from "@/lib/admin.functions";
import { AdminHeader, AdminCard } from "@/components/admin/AdminShell";

type Provider = {
  id: string;
  name: string;
  base_url: string;
  enabled: boolean;
  priority: number;
  notes: string | null;
  last_status: string | null;
  last_checked_at: string | null;
};

export const Route = createFileRoute("/_authenticated/admin/providers")({
  head: () => ({ meta: [{"title": "Providers \u2014 AniEra Admin"}, {"name": "description", "content": "Manage AniEra playback providers."}, {"property": "og:title", "content": "Providers \u2014 AniEra Admin"}, {"property": "og:description", "content": "Manage AniEra playback providers."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}, {"name": "robots", "content": "noindex"}] }),
  component: ProvidersPage,
});

function ProvidersPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-providers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_providers")
        .select("*")
        .order("priority", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Provider[];
    },
  });

  const save = useServerFn(saveProvider);
  const del = useServerFn(deleteProvider);
  const check = useServerFn(checkProviderHealth);
  const [editing, setEditing] = useState<Partial<Provider> | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-providers"] });

  const saveMut = useMutation({
    mutationFn: (p: Partial<Provider>) =>
      save({ data: {
        id: p.id,
        name: p.name!,
        base_url: p.base_url!,
        enabled: p.enabled ?? true,
        priority: p.priority ?? 100,
        notes: p.notes ?? null,
      } }),
    onSuccess: () => { toast.success("Provider saved"); invalidate(); setEditing(null); },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Provider removed"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Delete failed"),
  });

  const checkMut = useMutation({
    mutationFn: (id: string) => check({ data: { id } }),
    onSuccess: (r) => { toast.message(`Health: ${r.status}`); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Check failed"),
  });

  return (
    <>
      <AdminHeader
        title="API Providers"
        description="Registry of anime data & streaming providers. Toggle, reorder by priority, and run health checks."
        actions={
          <button
            onClick={() => setEditing({ enabled: true, priority: 100 })}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-neon-cyan to-neon-magenta px-4 py-2 text-xs font-semibold text-background"
          >
            <Plus className="h-4 w-4" /> Add provider
          </button>
        }
      />

      {editing && (
        <AdminCard className="mb-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-white">
              {editing.id ? "Edit provider" : "New provider"}
            </h2>
            <button onClick={() => setEditing(null)} className="text-white/60 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-wider text-white/50">Name</span>
              <input className="inp" value={editing.name ?? ""} onChange={e => setEditing({ ...editing, name: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-wider text-white/50">Priority (lower first)</span>
              <input type="number" className="inp" value={editing.priority ?? 100} onChange={e => setEditing({ ...editing, priority: Number(e.target.value) })} />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs uppercase tracking-wider text-white/50">Base URL</span>
              <input className="inp" value={editing.base_url ?? ""} onChange={e => setEditing({ ...editing, base_url: e.target.value })} placeholder="https://…" />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs uppercase tracking-wider text-white/50">Notes</span>
              <input className="inp" value={editing.notes ?? ""} onChange={e => setEditing({ ...editing, notes: e.target.value })} />
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={editing.enabled ?? true} onChange={e => setEditing({ ...editing, enabled: e.target.checked })} />
              <span className="text-sm text-white/80">Enabled</span>
            </label>
          </div>
          <button
            onClick={() => saveMut.mutate(editing)}
            disabled={saveMut.isPending || !editing.name || !editing.base_url}
            className="mt-4 flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {saveMut.isPending ? "Saving…" : "Save provider"}
          </button>
        </AdminCard>
      )}

      <AdminCard>
        {q.isLoading ? (
          <p className="text-sm text-white/60">Loading…</p>
        ) : (q.data ?? []).length === 0 ? (
          <p className="text-sm text-white/60">No providers yet.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {(q.data ?? []).map(p => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm font-bold text-white">{p.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${p.enabled ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/40"}`}>
                      {p.enabled ? "Enabled" : "Disabled"}
                    </span>
                    <span className="text-[10px] text-white/40">priority {p.priority}</span>
                  </div>
                  <div className="truncate text-xs text-white/50">{p.base_url}</div>
                  {p.last_status && (
                    <div className="mt-1 text-[11px] text-white/40">
                      {p.last_status}{p.last_checked_at ? ` · ${new Date(p.last_checked_at).toLocaleTimeString()}` : ""}
                    </div>
                  )}
                </div>
                <button onClick={() => checkMut.mutate(p.id)} disabled={checkMut.isPending} className="flex items-center gap-1 rounded bg-white/5 px-2 py-1 text-xs text-white/80 hover:bg-white/10">
                  <Activity className="h-3.5 w-3.5" /> Test
                </button>
                <button onClick={() => setEditing(p)} className="rounded bg-white/5 px-2 py-1 text-xs text-white/80 hover:bg-white/10">Edit</button>
                <button onClick={() => { if (confirm(`Delete ${p.name}?`)) delMut.mutate(p.id); }} className="flex items-center gap-1 rounded bg-red-500/20 px-2 py-1 text-xs text-red-200 hover:bg-red-500/30">
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
      <style>{`.inp{width:100%;background:rgba(255,255,255,0.06);color:white;border:1px solid rgba(255,255,255,0.1);border-radius:0.5rem;padding:0.5rem 0.75rem;font-size:0.875rem}.inp:focus{outline:2px solid rgba(139,92,246,0.6)}`}</style>
    </>
  );
}
