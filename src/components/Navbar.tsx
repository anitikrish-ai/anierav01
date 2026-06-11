import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export function Navbar() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const pathname = useRouterState({ select: s => s.location.pathname });
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) navigate({ to: "/browse", search: { q: q.trim() } as any });
  };

  const links = [
    { to: "/", label: "Home" },
    { to: "/browse", label: "Browse" },
    { to: "/library", label: "Library" },
  ];

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled ? "glass-strong" : "bg-transparent"
      }`}
    >
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

        <form onSubmit={submit} className="ml-auto min-w-0 flex-1 max-w-md">
          <div className="glass flex items-center gap-2 rounded-full px-4 py-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-white/60">
              <circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" />
            </svg>
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search anime…"
              className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
            />
          </div>
        </form>
      </div>
    </header>
  );
}