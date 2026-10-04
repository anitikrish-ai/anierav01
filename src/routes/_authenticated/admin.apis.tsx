import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Trash2, Play } from "lucide-react";
import { listCustomApisAdmin, toggleCustomApiAdmin, softDeleteCustomApiAdmin } from "@/lib/admin.functions";
import { callCustomApi } from "@/lib/custom-api";
import { AdminHeader, AdminCard } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/_authenticated/admin/apis")({
  head: () => ({ meta: [{ title: "Custom APIs · Admin" }, { name: "robots", content: "noindex" }] }),
  component: ApisPage,
});

function ApisPage() {
  const list = useServerFn(listCustomApisAdmin);
  const toggle = useServerFn(toggleCustomApiAdmin);
  const del = useServerFn(softDeleteCustomApiAdmin);
  const call = useServerFn(callCustomApi);
  const qc = useQueryClient();
  const [testQ, setTestQ] = useState("naruto");
  const [result, setResult] = useState<{ slug: string; text: string } | null>(null);

  const apis = useQuery({ queryKey: ["admin-custom-apis"], queryFn: () => list() });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-custom-apis"] }); qc.invalidateQueries({ queryKey: ["custom-apis"] }); };

  const toggleMut = useMutation({
    mutationFn: (v: { id: string; enabled: boolean }) => toggle({ data: v }),
    onSuccess: () => { toast.success("Updated"); refresh(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Moved to trash (restore from the private panel)"); refresh(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const test = async (slug: string) => {
    setResult({ slug, text: "Running…" });
    const r = await call({ data: { slug, query: testQ } });
    setResult({ slug, text: `HTTP ${r.status}${r.viaProxy ? ` via ${r.viaProxy}` : ""}\n\n${r.body.slice(0, 3000)}` });
  };

  return (
    <>
      <AdminHeader
        title="Custom APIs"
        description="APIs added through the private panel. Enabled ones appear as Extra sources on Browse, Schedule and anime pages. Create or edit full configs in the private panel."
      />
      <AdminCard className="mb-4">
        <label className="text-xs text-white/60">Test query</label>
        <input value={testQ} onChange={e => setTestQ(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" />
      </AdminCard>
      <AdminCard>
        {apis.isLoading ? <p className="text-sm text-white/60">Loading…</p> :
        (apis.data ?? []).length === 0 ? <p className="text-sm text-white/60">No custom APIs yet.</p> :
        <ul className="divide-y divide-white/5">
          {(apis.data ?? []).map((a: any) => (
            <li key={a.id} className="py-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`h-2 w-2 rounded-full ${a.enabled ? "bg-emerald-400" : "bg-white/30"}`} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-white">{a.name} <span className="text-[11px] text-white/40">/{a.slug} · {a.category}</span></div>
                  <div className="truncate text-[11px] text-white/40">{a.method} {a.base_url}{a.path}</div>
                </div>
                <button onClick={() => test(a.slug)} disabled={!a.enabled} className="flex items-center gap-1 rounded bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20 disabled:opacity-40"><Play className="h-3.5 w-3.5" /> Test</button>
                <button onClick={() => toggleMut.mutate({ id: a.id, enabled: !a.enabled })} className="rounded bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20">{a.enabled ? "Disable" : "Enable"}</button>
                <button onClick={() => { if (confirm(`Delete ${a.name}?`)) delMut.mutate(a.id); }} className="flex items-center gap-1 rounded bg-red-500/20 px-2 py-1 text-xs text-red-200 hover:bg-red-500/30"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              {result?.slug === a.slug && (
                <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-black/40 p-3 text-[11px] text-white/80">{result.text}</pre>
              )}
            </li>
          ))}
        </ul>}
      </AdminCard>
    </>
  );
}
