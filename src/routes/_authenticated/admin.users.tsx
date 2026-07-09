import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Trash2, ShieldPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listAdmins, grantAdmin, revokeAdmin } from "@/lib/admin.functions";
import { AdminHeader, AdminCard } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: UsersPage,
});

function UsersPage() {
  const list = useServerFn(listAdmins);
  const grant = useServerFn(grantAdmin);
  const revoke = useServerFn(revokeAdmin);
  const qc = useQueryClient();
  const [uid, setUid] = useState("");

  const admins = useQuery({ queryKey: ["admin-admins"], queryFn: () => list() });

  const profiles = useQuery({
    queryKey: ["admin-profiles-for-roles", admins.data],
    queryFn: async () => {
      const ids = (admins.data ?? []).map((r: any) => r.user_id);
      if (!ids.length) return [];
      const { data, error } = await supabase
        .from("profiles").select("id, display_name").in("id", ids);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!admins.data,
  });

  const grantMut = useMutation({
    mutationFn: (user_id: string) => grant({ data: { user_id } }),
    onSuccess: () => { toast.success("Admin granted"); setUid(""); qc.invalidateQueries({ queryKey: ["admin-admins"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Grant failed"),
  });
  const revokeMut = useMutation({
    mutationFn: (user_id: string) => revoke({ data: { user_id } }),
    onSuccess: () => { toast.success("Admin revoked"); qc.invalidateQueries({ queryKey: ["admin-admins"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Revoke failed"),
  });

  const nameFor = (id: string) => (profiles.data ?? []).find((p: any) => p.id === id)?.display_name ?? id;

  return (
    <>
      <AdminHeader
        title="Administrators"
        description="Grant or revoke the admin role. Users must have signed up at least once — copy their user ID from Cloud → Users."
      />
      <AdminCard className="mb-4">
        <h2 className="font-display text-lg font-bold text-white">Grant admin</h2>
        <div className="mt-3 flex gap-2">
          <input
            placeholder="User UUID"
            value={uid}
            onChange={e => setUid(e.target.value)}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
          />
          <button
            onClick={() => grantMut.mutate(uid)}
            disabled={!uid || grantMut.isPending}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-neon-cyan to-neon-magenta px-4 py-2 text-xs font-semibold text-background disabled:opacity-50"
          >
            <ShieldPlus className="h-4 w-4" /> Grant
          </button>
        </div>
      </AdminCard>

      <AdminCard>
        <h2 className="font-display text-lg font-bold text-white">Current admins</h2>
        {admins.isLoading ? <p className="mt-3 text-sm text-white/60">Loading…</p> :
        (admins.data ?? []).length === 0 ? <p className="mt-3 text-sm text-white/60">No admins yet.</p> :
        <ul className="mt-3 divide-y divide-white/5">
          {(admins.data ?? []).map((r: any) => (
            <li key={r.id} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-white">{nameFor(r.user_id)}</div>
                <div className="truncate text-[11px] text-white/40">{r.user_id}</div>
              </div>
              <button
                onClick={() => { if (confirm("Revoke admin?")) revokeMut.mutate(r.user_id); }}
                className="flex items-center gap-1 rounded bg-red-500/20 px-2 py-1 text-xs text-red-200 hover:bg-red-500/30"
              >
                <Trash2 className="h-3.5 w-3.5" /> Revoke
              </button>
            </li>
          ))}
        </ul>}
      </AdminCard>
    </>
  );
}
