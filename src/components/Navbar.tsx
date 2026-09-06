import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { jikan, bestTitle } from "@/lib/jikan";
import { supabase } from "@/integrations/supabase/client";

const RECENT_KEY = "aniera:recent-searches";

function readRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter(x => typeof x === "string").slice(0, 6) : [];
  } catch {
    return [];
  }
}

export function Navbar() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [debounced, setDebounced] = useState("");
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);
  const pathname = useRouterState({ select: s => s.location.pathname });
  const [scrolled, setScrolled] = useState(false);
  const { user, signedIn } = useAuth();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setRecent(readRecent()), []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => setActive(-1), [debounced]);

  // Close panels on outside click and on route change.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    setOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  const sugg = useQuery({
    queryKey: ["search-suggest", debounced],
    queryFn: () => jikan.search({ q: debounced, limit: 8 }),
    enabled: debounced.length >= 2,
    staleTime: 1000 * 60,
    retry: 0,
  });
  const results = useMemo(() => sugg.data?.data?.slice(0, 6) ?? [], [sugg.data]);

  const remember = (term: string) => {
    const next = [term, ...readRecent().filter(t => t.toLowerCase() !== term.toLowerCase())].slice(0, 6);
    setRecent(next);
    try {
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      // localStorage may be unavailable (private mode) — recent search is optional.
    }
  };

  const runSearch = (term: string) => {
    const t = term.trim();
    if (!t) return;
    remember(t);
    navigate({ to: "/browse", search: { q: t } });
    setOpen(false);
    inputRef.current?.blur();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (active >= 0 && results[active]) {
      const a = results[active];
      setOpen(false);
      navigate({ to: "/anime/$id", params: { id: String(a.mal_id) } });
      return;
    }
    runSearch(q);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(i => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(i => (i <= 0 ? results.length - 1 : i - 1));
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
    { to: "/", label: "Home" },
    { to: "/browse", label: "Browse" },
    { to: "/schedule", label: "Schedule" },
    { to: "/library", label: "Library" },
    ...(isAdmin.data ? [{ to: "/admin", label: "Admin" }] : []),
  ];

  const showPanel = open && (debounced.length >= 2 || (q.length === 0 && recent.length > 0));

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled ? "glass-strong" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-3 sm:gap-4 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="AniEra home">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-neon-cyan to-neon-magenta glow-cyan">
            <span className="font-display text-sm font-bold text-background">A</span>
          </div>
          <span className="hidden font-display text-lg font-bold tracking-tight text-gradient sm:inline">AniEra</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {links.map(l => {
            const activeLink = pathname === l.to;
            return (
              <Link
                key={l.to}
                to={l.to}
                aria-current={activeLink ? "page" : undefined}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  activeLink ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div ref={wrapRef} className="relative ml-auto min-w-0 flex-1 sm:max-w-md">
          <form onSubmit={submit} role="search">
            <div className="glass flex items-center gap-2 rounded-full px-3 py-2 sm:px-4">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-white/60" aria-hidden="true">
                <circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" />
              </svg>
              <input
                ref={inputRef}
                value={q}
                onChange={e => { setQ(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                onKeyDown={onKeyDown}
                type="search"
                aria-label="Search anime"
                role="combobox"
                aria-expanded={showPanel}
                aria-controls="nav-search-results"
                placeholder="Search anime…"
                className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => { setQ(""); setOpen(true); inputRef.current?.focus(); }}
                  aria-label="Clear search"
                  className="shrink-0 rounded-full p-1 text-white/50 transition hover:bg-white/10 hover:text-white"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </form>

          {showPanel && (
            <div
              id="nav-search-results"
              role="listbox"
              className="anim-fade absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl glass-strong ring-1 ring-white/10"
            >
              {debounced.length < 2 ? (
                <>
                  <div className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                    Recent searches
                  </div>
                  {recent.map(term => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => runSearch(term)}
                      className="block w-full px-4 py-2 text-left text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
                    >
                      {term}
                    </button>
                  ))}
                </>
              ) : (
                <>
                  {sugg.isLoading && (
                    <div className="space-y-2 p-3">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="h-12 w-9 shrink-0 rounded-md shimmer" />
                          <div className="h-3 w-2/3 rounded shimmer" />
                        </div>
                      ))}
                    </div>
                  )}
                  {sugg.isError && (
                    <div className="px-4 py-3 text-xs text-white/60">
                      Search is temporarily unavailable.{" "}
                      <button type="button" onClick={() => sugg.refetch()} className="text-neon-cyan underline">
                        Retry
                      </button>
                    </div>
                  )}
                  {!sugg.isLoading && !sugg.isError && results.length === 0 && (
                    <div className="px-4 py-3 text-xs text-white/60">No matches for “{debounced}”.</div>
                  )}
                  {results.map((a, i) => (
                    <Link
                      key={a.mal_id}
                      to="/anime/$id"
                      params={{ id: String(a.mal_id) }}
                      role="option"
                      aria-selected={i === active}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => { setOpen(false); setQ(""); }}
                      className={`flex items-center gap-3 px-3 py-2 transition ${i === active ? "bg-white/10" : "hover:bg-white/10"}`}
                    >
                      <img
                        src={a.images.webp?.image_url || a.images.jpg.image_url}
                        alt=""
                        loading="lazy"
                        decoding="async"
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
                      type="button"
                      onClick={() => runSearch(debounced)}
                      className="block w-full border-t border-white/10 px-4 py-2 text-left text-xs font-medium text-neon-cyan hover:bg-white/5"
                    >
                      See all results for “{debounced}” →
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {signedIn ? (
          <Link to="/profile" className="shrink-0 rounded-full glass p-1 sm:pr-3" title="Profile" aria-label="Your profile">
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
          <Link
            to="/auth"
            className="shrink-0 rounded-full bg-gradient-to-r from-neon-cyan to-neon-magenta px-3 py-2 text-xs font-semibold text-background sm:px-4"
          >
            Sign in
          </Link>
        )}

        <button
          type="button"
          onClick={() => setMenuOpen(o => !o)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl glass text-white md:hidden"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            {menuOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <nav className="anim-fade border-t border-white/10 glass-strong md:hidden" aria-label="Mobile">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-3 py-3">
            {links.map(l => (
              <Link
                key={l.to}
                to={l.to}
                aria-current={pathname === l.to ? "page" : undefined}
                className={`rounded-xl px-4 py-3 text-sm font-medium transition ${
                  pathname === l.to ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
