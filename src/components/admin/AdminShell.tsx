import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  Settings,
  Palette,
  Plug,
  Search,
  Users,
  ShieldCheck,
  DatabaseBackup,
  ScrollText,
  Globe,
  Boxes,
} from "lucide-react";

const items: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/settings", label: "Global Settings", icon: Settings },
  { to: "/admin/theme", label: "Theme & Background", icon: Palette },
  { to: "/admin/providers", label: "API Providers", icon: Plug },
  { to: "/admin/apis", label: "Custom APIs", icon: Boxes },
  { to: "/admin/proxies", label: "Proxies & Logs", icon: Globe },
  { to: "/admin/seo", label: "SEO Overrides", icon: Search },
  { to: "/admin/users", label: "Users & Roles", icon: Users },
  { to: "/admin/backup", label: "Backup & Restore", icon: DatabaseBackup },
  { to: "/admin/audit", label: "Audit Trail", icon: ScrollText },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: s => s.location.pathname });
  return (
    <div className="mx-auto grid w-full max-w-7xl gap-4 px-3 py-4 sm:px-4 lg:grid-cols-[240px_1fr] lg:gap-6 lg:py-6">
      <aside className="glass-strong h-max min-w-0 rounded-2xl p-2 lg:sticky lg:top-20 lg:p-3">
        <div className="mb-2 hidden items-center gap-2 px-3 py-2 lg:flex">
          <ShieldCheck className="h-5 w-5 text-neon-cyan" />
          <span className="font-display text-sm font-bold tracking-wide text-white">
            Admin CMS
          </span>
        </div>
        <nav aria-label="Admin sections" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {items.map(item => {
            const active = item.exact
              ? pathname === item.to
              : pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to as any}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <section className="min-w-0">{children}</section>
    </div>
  );
}

export function AdminHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-white">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-white/60">{description}</p>
        )}
      </div>
      {actions}
    </div>
  );
}

export function AdminCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`glass-strong rounded-2xl p-5 ${className}`}>{children}</div>
  );
}
