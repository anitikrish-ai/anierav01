import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldPlus, ShieldMinus } from "lucide-react";
import { listAllUsers, setUserRole } from "@/lib/admin.functions";
import { AdminHeader, AdminCard } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "Users & Roles · Admin" }, { name: "robots", content: "noindex" }] }),
  component: UsersPage,
});

type Role = "admin" | "moderator" | "user";
const ROLES: Role[] = ["admin", "moderator", "user"];

function UsersPage() {
  const list = useServerFn(listAllUsers);
  const setRole = useServerFn(setUserRole);
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRoleSel] = useState<Role>("admin");
  const [filter, setFilter] = useState("");

  const users = useQuery({ queryKey: ["admin-all-users"], queryFn: () => list() });

  const mut = useMutation({
    mutationFn: (v: { email: string; role: Role; grant: boolean }) => setRole({ data: v }),
    onSuccess: (_d, v) => {
      toast.success(`${v.grant ? "Granted" : "Revoked"} ${v.role}`);
      if (v.grant) setEmail("");
      qc.invalidateQueries({ queryKey: ["admin-all-users"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const rows = useMemo(() => {
    const f = filter.toLowerCase();
    return (users.data ?? []).filter(u => !f || u.email.toLowerCase().includes(f) || (u.display_name ?? "").toLowerCase().includes(f));
  }, [users.data, filter]);

  return (
    <>
      <AdminHeader title="Users & Roles" description="Every signed-up account. Grant or revoke roles by email." />
      <AdminCard className="mb-4">
        <h2 className="font-display text-lg font-bold text-white">Grant a role</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="email"
            placeholder="user@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="min-w-[200px] flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
          />
          <select value={role} onChange={e => setRoleSel(e.target.value as Role)} className="rounded-lg border border-white/10 bg-background px-3 py-2 text-sm text-white">
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button
            onClick={() => mut.mutate({ email, role, grant: true })}
            disabled={!email || mut.isPending}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            <ShieldPlus className="h-4 w-4" /> Grant
          </button>
        </div>
      </AdminCard>

      <AdminCard>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-lg font-bold text-white">All users ({users.data?.length ?? 0})</h2>
          <input placeholder="Filter…" value={filter} onChange={e => setFilter(e.target.value)} className="ml-auto rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white" />
        </div>
        {users.isLoading ? <p className="mt-3 text-sm text-white/60">Loading…</p> :
        users.error ? <p className="mt-3 text-sm text-red-300">{(users.error as Error).message}</p> :
        rows.length === 0 ? <p className="mt-3 text-sm text-white/60">No users.</p> :
        <ul className="mt-3 divide-y divide-white/5">
          {rows.map(u => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-white">{u.display_name ?? u.email}</div>
                <div className="truncate text-[11px] text-white/40">{u.email} · joined {new Date(u.created_at).toLocaleDateString()}</div>
              </div>
              <div className="flex flex-wrap gap-1">
                {u.roles.length === 0 && <span className="text-[11px] text-white/40">no roles</span>}
                {u.roles.map((r: string) => (
                  <button
                    key={r}
                    title={`Revoke ${r}`}
                    onClick={() => { if (confirm(`Revoke ${r} from ${u.email}?`)) mut.mutate({ email: u.email, role: r as Role, grant: false }); }}
                    className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white hover:bg-red-500/30"
                  >
                    {r} <ShieldMinus className="h-3 w-3" />
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>}
      </AdminCard>
    </>
  );
}
