import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { jikan, bestTitle } from "@/lib/jikan";
import { supabase } from "@/integrations/supabase/client";
import { ThemeControl } from "@/components/ThemeControl";
import { Home, Compass, CalendarDays, Library, Shield } from "lucide-react";

export function Navbar() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState("");
  const pathname = useRouterState({ select: s => s.location.pathname });
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const { user, signedIn } = useAuth();
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 8);
      if (y > 120 && y > last + 4) setHidden(true);
      else if (y < last - 4 || y < 120) setHidden(false);
      last = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  const sugg = useQuery({
    queryKey: ["search-suggest", debounced],
    queryFn: () => jikan.search({ q: debounced, limit: 8 }),
    enabled: debounced.length >= 2,
    staleTime: 1000 * 60,
  });
  const results = sugg.data?.data?.slice(0, 6) ?? [];


  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) {
      navigate({ to: "/browse", search: { q: q.trim() } as any });
      setOpen(false);
    }
  };

  const isAdmin = useQuery({
    queryKey: ["is-admin-nav", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const links = [
    { to: "/", label: "Home", icon: Home },
    { to: "/browse", label: "Browse", icon: Compass },
    { to: "/schedule", label: "Schedule", icon: CalendarDays },
    { to: "/library", label: "Library", icon: Library },
    ...(isAdmin.data ? [{ to: "/admin", label: "Admin", icon: Shield }] : []),
  ];

  return (
    <>
    <header
      className={`sticky top-0 z-[20] px-2 pt-2 transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)] sm:px-4 ${hidden && !open ? "nav-hidden" : ""}`}
    >
      <div className={`mx-auto max-w-7xl rounded-[28px] transition-shadow ${scrolled ? "liquid-glass" : ""}`}>
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-neon-cyan to-neon-magenta glow-cyan">
            <span className="font-display text-sm font-bold text-background">A</span>
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-gradient">AniEra</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map(l => {
            const active = pathname === l.to;
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div ref={wrapRef} className="relative ml-auto min-w-0 flex-1 max-w-md">
        <form onSubmit={submit}>
          <div className="liquid-glass flex min-h-11 items-center gap-2 rounded-full px-4 py-2">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-white/60">
              <circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" />
            </svg>
            <input
              value={q}
              onChange={e => { setQ(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              placeholder="Search anime…"
              aria-label="Search anime"
              className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
            />
          </div>
        </form>
          {open && debounced.length >= 2 && (
            <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl glass-strong ring-1 ring-white/10">
              {sugg.isLoading && <div className="px-4 py-3 text-xs text-white/60">Searching…</div>}
              {!sugg.isLoading && results.length === 0 && (
                <div className="px-4 py-3 text-xs text-white/60">No matches.</div>
              )}
              {results.map(a => (
                <Link
                  key={a.mal_id}
                  to="/anime/$id"
                  params={{ id: String(a.mal_id) }}
                  onClick={() => { setOpen(false); setQ(""); }}
                  className="flex items-center gap-3 px-3 py-2 transition hover:bg-white/10"
                >
                  <img
                    src={a.images.webp?.image_url || a.images.jpg.image_url}
                    alt=""
                    className="h-12 w-9 shrink-0 rounded-md object-cover"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white">{bestTitle(a)}</div>
                    <div className="truncate text-[11px] text-white/50">
                      {[a.type, a.year, a.score ? `★ ${a.score.toFixed(1)}` : null].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                </Link>
              ))}
              {results.length > 0 && (
                <button
                  onClick={() => { navigate({ to: "/browse", search: { q: debounced } as any }); setOpen(false); }}
                  className="block w-full border-t border-white/10 px-4 py-2 text-left text-xs font-medium text-neon-cyan hover:bg-white/5"
                >
                  See all results for “{debounced}” →
                </button>
              )}
            </div>
          )}
        </div>

        <ThemeControl />
        {signedIn ? (
          <Link to="/profile" className="shrink-0 rounded-full glass p-1 pr-3 transition hover:bg-white/10" title="Profile">
            <div className="flex items-center gap-2">
              {user?.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <div className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-neon-cyan to-neon-magenta text-[11px] font-bold text-background">
                  {(user?.email ?? "?")[0].toUpperCase()}
                </div>
              )}
              <span className="hidden text-xs font-medium text-white sm:inline">
                {user?.user_metadata?.full_name ?? user?.email?.split("@")[0]}
              </span>
            </div>
          </Link>
        ) : (
          <Link to="/auth" className="shrink-0 rounded-full bg-gradient-to-r from-neon-cyan to-neon-magenta px-4 py-2 text-xs font-semibold text-background">
            Sign in
          </Link>
        )}
      </div>
      </div>
    </header>
    <nav aria-label="Primary" className="liquid-glass fixed inset-x-3 z-[20] flex justify-around rounded-[28px] p-1.5 md:hidden" style={{ bottom: "calc(12px + env(safe-area-inset-bottom))" }}>
      {links.map(l => {
        const active = l.to === "/" ? pathname === "/" : pathname.startsWith(l.to);
        const Icon = l.icon;
        return (
          <Link key={l.to} to={l.to} aria-current={active ? "page" : undefined}
            className={`glass-press flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-[20px] text-[10px] font-medium ${active ? "bg-white/15 text-white" : "text-white/70"}`}>
            <Icon className="h-5 w-5" aria-hidden="true" />{l.label}
          </Link>
        );
      })}
    </nav>
    </>
  );
}