import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminStats } from "@/lib/admin.functions";
import { AdminHeader, AdminCard } from "@/components/admin/AdminShell";
import { useSiteSettings } from "@/lib/site-settings";
import {
  Library,
  Users as UsersIcon,
  Plug,
  Search,
  ShieldCheck,
  Palette,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: DashboardPage,
});

function DashboardPage() {
  const stats = useServerFn(getAdminStats);
  const settings = useSiteSettings();
  const q = useQuery({ queryKey: ["admin-stats"], queryFn: () => stats() });
  const d = q.data;

  const cards = [
    { label: "Library entries", value: d?.libraryEntries ?? "—", icon: Library },
    { label: "Profiles", value: d?.profiles ?? "—", icon: UsersIcon },
    {
      label: "API providers",
      value:
        d != null
          ? `${d.providersEnabled}/${d.providersTotal}`
          : "—",
      icon: Plug,
    },
    { label: "SEO overrides", value: d?.seoOverrides ?? "—", icon: Search },
    { label: "Administrators", value: d?.admins ?? "—", icon: ShieldCheck },
    { label: "Accent color", value: settings.accent_color, icon: Palette },
  ];

  return (
    <>
      <AdminHeader
        title="Admin Dashboard"
        description="Live snapshot of your site. Every setting below is stored in the database and applied to the live site instantly."
      />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {cards.map(c => {
          const Icon = c.icon;
          return (
            <AdminCard key={c.label}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wider text-white/50">
                    {c.label}
                  </div>
                  <div className="mt-1 font-display text-2xl font-bold text-white">
                    {c.value}
                  </div>
                </div>
                <Icon className="h-8 w-8 text-neon-cyan/70" />
              </div>
            </AdminCard>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <AdminCard>
          <h2 className="font-display text-lg font-bold text-white">
            Site identity
          </h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Title" value={settings.site_title} />
            <Row label="Tagline" value={settings.site_description} />
            <Row label="Logo" value={settings.logo_url || "—"} />
          </dl>
        </AdminCard>
        <AdminCard>
          <h2 className="font-display text-lg font-bold text-white">
            Homepage sections
          </h2>
          <ul className="mt-3 space-y-1 text-sm">
            {settings.homepage_sections.map(s => (
              <li key={s.key} className="flex items-center justify-between">
                <span className="text-white/80">{s.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] ${
                    s.enabled
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-white/10 text-white/40"
                  }`}
                >
                  {s.enabled ? "Enabled" : "Hidden"}
                </span>
              </li>
            ))}
          </ul>
        </AdminCard>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-white/50">{label}</dt>
      <dd className="min-w-0 truncate text-white">{value}</dd>
    </div>
  );
}
