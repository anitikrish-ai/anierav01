import { createFileRoute, Outlet, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { checkIsAdmin } from "@/lib/admin.functions";
import { AdminShell } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{"title": "Administration \u2014 AniEra"}, {"name": "description", "content": "Manage AniEra site administration."}, {"property": "og:title", "content": "Administration \u2014 AniEra"}, {"property": "og:description", "content": "Manage AniEra site administration."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}, {"name": "robots", "content": "noindex"}] }),
  component: AdminLayout,
});

function AdminLayout() {
  const check = useServerFn(checkIsAdmin);
  const router = useRouter();
  const q = useQuery({
    queryKey: ["admin-gate"],
    queryFn: () => check(),
    staleTime: 60_000,
    retry: false,
  });

  if (q.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-white/60">
        Checking admin access…
      </div>
    );
  }
  if (q.error || !q.data?.isAdmin) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="glass-strong rounded-2xl p-8">
          <h1 className="font-display text-2xl font-bold text-white">
            Admin access required
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Your account does not have the admin role. Ask an existing
            administrator to grant it, or run the SQL snippet from the setup
            instructions.
          </p>
          <button
            onClick={() => { router.invalidate(); q.refetch(); }}
            disabled={q.isFetching}
            className="mt-4 rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20 disabled:opacity-50"
          >
            {q.isFetching ? "Checking…" : "Re-check"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
