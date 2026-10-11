import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { saveSeo, deleteSeo } from "@/lib/admin.functions";
import { AdminHeader, AdminCard } from "@/components/admin/AdminShell";

type Seo = {
  id: string;
  route: string;
  title: string | null;
  description: string | null;
  og_image: string | null;
  keywords: string | null;
};

export const Route = createFileRoute("/_authenticated/admin/seo")({
  head: () => ({ meta: [{"title": "Search Visibility \u2014 AniEra Admin"}, {"name": "description", "content": "Manage AniEra search visibility settings."}, {"property": "og:title", "content": "Search Visibility \u2014 AniEra Admin"}, {"property": "og:description", "content": "Manage AniEra search visibility settings."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}, {"name": "robots", "content": "noindex"}] }),
  component: SeoPage,
});

function SeoPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-seo"],
    queryFn: async () => {
      const { data, error } = await supabase.from("seo_overrides").select("*").order("route");
      if (error) throw error;
      return (data ?? []) as Seo[];
    },
  });
  const save = useServerFn(saveSeo);
  const del = useServerFn(deleteSeo);
  const [editing, setEditing] = useState<Partial<Seo> | null>(null);

  const saveMut = useMutation({
    mutationFn: (s: Partial<Seo>) => save({ data: {
      id: s.id,
      route: s.route!,
      title: s.title ?? null,
      description: s.description ?? null,
      og_image: s.og_image ?? null,
      keywords: s.keywords ?? null,
    } }),
    onSuccess: () => { toast.success("SEO saved"); qc.invalidateQueries({ queryKey: ["admin-seo"] }); setEditing(null); },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["admin-seo"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Delete failed"),
  });

  return (
    <>
      <AdminHeader
        title="SEO Overrides"
        description="Override the head <title>, meta description, keywords, and OG image per route. Overrides merge with the built-in defaults."
        actions={
          <button onClick={() => setEditing({ route: "/" })} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-neon-cyan to-neon-magenta px-4 py-2 text-xs font-semibold text-background">
            <Plus className="h-4 w-4" /> New override
          </button>
        }
      />

      {editing && (
        <AdminCard className="mb-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-white">
              {editing.id ? `Edit ${editing.route}` : "New override"}
            </h2>
            <button onClick={() => setEditing(null)} className="text-white/60 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
          <div className="mt-4 space-y-3">
            <Fld label="Route (must start with /)">
              <input className="inp" value={editing.route ?? ""} onChange={e => setEditing({ ...editing, route: e.target.value })} placeholder="/browse" />
            </Fld>
            <Fld label="Title">
              <input className="inp" value={editing.title ?? ""} onChange={e => setEditing({ ...editing, title: e.target.value })} maxLength={160} />
            </Fld>
            <Fld label="Description">
              <textarea className="inp h-20" value={editing.description ?? ""} onChange={e => setEditing({ ...editing, description: e.target.value })} maxLength={400} />
            </Fld>
            <Fld label="OG image URL">
              <input className="inp" value={editing.og_image ?? ""} onChange={e => setEditing({ ...editing, og_image: e.target.value })} />
            </Fld>
            <Fld label="Keywords (comma-separated)">
              <input className="inp" value={editing.keywords ?? ""} onChange={e => setEditing({ ...editing, keywords: e.target.value })} />
            </Fld>
          </div>
          <button onClick={() => saveMut.mutate(editing)} disabled={saveMut.isPending || !editing.route} className="mt-4 flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 disabled:opacity-50">
            <Save className="h-4 w-4" /> {saveMut.isPending ? "Saving…" : "Save override"}
          </button>
        </AdminCard>
      )}

      <AdminCard>
        {q.isLoading ? <p className="text-sm text-white/60">Loading…</p> :
         (q.data ?? []).length === 0 ? <p className="text-sm text-white/60">No overrides yet.</p> :
        <ul className="divide-y divide-white/5">
          {(q.data ?? []).map(s => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="font-display text-sm font-bold text-white">{s.route}</div>
                <div className="truncate text-xs text-white/60">{s.title ?? <span className="italic opacity-50">no title</span>}</div>
                <div className="truncate text-[11px] text-white/40">{s.description ?? ""}</div>
              </div>
              <button onClick={() => setEditing(s)} className="rounded bg-white/5 px-2 py-1 text-xs text-white/80 hover:bg-white/10">Edit</button>
              <button onClick={() => { if (confirm(`Remove override for ${s.route}?`)) delMut.mutate(s.id); }} className="flex items-center gap-1 rounded bg-red-500/20 px-2 py-1 text-xs text-red-200 hover:bg-red-500/30">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </li>
          ))}
        </ul>}
      </AdminCard>
      <style>{`.inp{width:100%;background:rgba(255,255,255,0.06);color:white;border:1px solid rgba(255,255,255,0.1);border-radius:0.5rem;padding:0.5rem 0.75rem;font-size:0.875rem}.inp:focus{outline:2px solid rgba(139,92,246,0.6)}`}</style>
    </>
  );
}
function Fld({ label, children }: { label: string; children: any }) {
  return <label className="block"><span className="mb-1 block text-xs uppercase tracking-wider text-white/50">{label}</span>{children}</label>;
}
