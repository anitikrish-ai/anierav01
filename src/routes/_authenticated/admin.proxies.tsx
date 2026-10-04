import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Trash2, Activity, Pencil } from "lucide-react";
import {
  listProxiesAdmin,
  saveProxyEndpoint,
  deleteProxyEndpoint,
  checkProxyEndpoint,
  listProxyLogs,
} from "@/lib/proxy.functions";
import { AdminHeader, AdminCard } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/_authenticated/admin/proxies")({
  head: () => ({ meta: [{ title: "Proxies & Logs · Admin" }, { name: "robots", content: "noindex" }] }),
  component: ProxiesPage,
});

type Form = { id?: string; label: string; url: string; display_ip: string; region: string; enabled: boolean; priority: number; notes: string };
const empty: Form = { label: "", url: "https://", display_ip: "", region: "", enabled: true, priority: 100, notes: "" };
const input = "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white";

function ProxiesPage() {
  const list = useServerFn(listProxiesAdmin);
  const save = useServerFn(saveProxyEndpoint);
  const del = useServerFn(deleteProxyEndpoint);
  const check = useServerFn(checkProxyEndpoint);
  const logsFn = useServerFn(listProxyLogs);
  const qc = useQueryClient();
  const [f, setF] = useState<Form>(empty);

  const proxies = useQuery({ queryKey: ["admin-proxies"], queryFn: () => list() });
  const logs = useQuery({ queryKey: ["admin-proxy-logs"], queryFn: () => logsFn(), refetchInterval: 30_000 });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-proxies"] }); qc.invalidateQueries({ queryKey: ["proxy-list"] }); };

  const saveMut = useMutation({
    mutationFn: () => save({ data: { ...f, display_ip: f.display_ip || null, region: f.region || null, notes: f.notes || null } }),
    onSuccess: () => { toast.success("Saved"); setF(empty); refresh(); },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); refresh(); },
    onError: (e: any) => toast.error(e?.message ?? "Delete failed"),
  });
  const checkMut = useMutation({
    mutationFn: (id: string) => check({ data: { id } }),
    onSuccess: r => { toast.message(r.status); refresh(); },
    onError: (e: any) => toast.error(e?.message ?? "Check failed"),
  });

  return (
    <>
      <AdminHeader title="Proxies & Logs" description="Relays visitors can choose in the site footer. Only https relays from this list are ever used." />
      <AdminCard className="mb-4">
        <h2 className="font-display text-lg font-bold text-white">{f.id ? "Edit relay" : "Add relay"}</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input className={input} placeholder="Label" value={f.label} onChange={e => setF({ ...f, label: e.target.value })} />
          <input className={input} placeholder="https://relay.example/?url=" value={f.url} onChange={e => setF({ ...f, url: e.target.value })} />
          <input className={input} placeholder="Display IP (optional)" value={f.display_ip} onChange={e => setF({ ...f, display_ip: e.target.value })} />
          <input className={input} placeholder="Region (optional)" value={f.region} onChange={e => setF({ ...f, region: e.target.value })} />
          <input className={input} type="number" placeholder="Priority" value={f.priority} onChange={e => setF({ ...f, priority: Number(e.target.value) || 0 })} />
          <label className="flex items-center gap-2 text-sm text-white/80"><input type="checkbox" checked={f.enabled} onChange={e => setF({ ...f, enabled: e.target.checked })} /> Enabled</label>
          <input className={`${input} sm:col-span-2`} placeholder="Notes" value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} />
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={() => saveMut.mutate()} disabled={!f.label || saveMut.isPending} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">Save</button>
          {f.id && <button onClick={() => setF(empty)} className="rounded-lg bg-white/10 px-4 py-2 text-xs text-white">Cancel</button>}
        </div>
      </AdminCard>

      <AdminCard className="mb-4">
        <h2 className="font-display text-lg font-bold text-white">Relays</h2>
        {proxies.isLoading ? <p className="mt-3 text-sm text-white/60">Loading…</p> :
        <ul className="mt-3 divide-y divide-white/5">
          {(proxies.data ?? []).map((p: any) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 py-2">
              <span className={`h-2 w-2 rounded-full ${p.enabled ? "bg-emerald-400" : "bg-white/30"}`} />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-white">{p.label} <span className="text-[11px] text-white/40">#{p.priority}{p.region ? ` · ${p.region}` : ""}</span></div>
                <div className="truncate text-[11px] text-white/40">{p.url} {p.last_status ? `· ${p.last_status}` : ""}</div>
              </div>
              <button onClick={() => checkMut.mutate(p.id)} className="flex items-center gap-1 rounded bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20"><Activity className="h-3.5 w-3.5" /> Check</button>
              <button onClick={() => setF({ id: p.id, label: p.label, url: p.url, display_ip: p.display_ip ?? "", region: p.region ?? "", enabled: p.enabled, priority: p.priority, notes: p.notes ?? "" })} className="rounded bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={() => { if (confirm(`Delete ${p.label}?`)) delMut.mutate(p.id); }} className="rounded bg-red-500/20 px-2 py-1 text-xs text-red-200 hover:bg-red-500/30"><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>}
      </AdminCard>

      <AdminCard>
        <h2 className="font-display text-lg font-bold text-white">Recent requests</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs text-white/80">
            <thead className="text-white/40"><tr><th className="py-1 pr-3">Time</th><th className="pr-3">Client IP</th><th className="pr-3">Relay</th><th className="pr-3">Host</th><th className="pr-3">Status</th><th>ms</th></tr></thead>
            <tbody>
              {(logs.data ?? []).map((l: any) => (
                <tr key={l.id} className="border-t border-white/5">
                  <td className="py-1 pr-3 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="pr-3">{l.client_ip ?? "—"}</td>
                  <td className="pr-3">{l.proxy_label ?? "direct"}</td>
                  <td className="pr-3">{l.target_host}</td>
                  <td className={`pr-3 ${l.ok ? "text-emerald-300" : "text-red-300"}`}>{l.status_code ?? l.message ?? "err"}</td>
                  <td>{l.latency_ms}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!logs.isLoading && (logs.data ?? []).length === 0 && <p className="text-sm text-white/60">No requests logged yet.</p>}
        </div>
      </AdminCard>
    </>
  );
}
