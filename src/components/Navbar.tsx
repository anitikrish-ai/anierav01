import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { jikan, bestTitle } from "@/lib/jikan";
import { supabase } from "@/integrations/supabase/client";
import { ThemeControl } from "@/components/ThemeControl";
import { Button } from "@/components/ui/button";
import { Home, Compass, CalendarDays, Library, Shield, Search, X, UserRound, ArrowRight } from "lucide-react";

export function Navbar() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: s => s.location.pathname });
  const { user, signedIn } = useAuth();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [debounced, setDebounced] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    setOpen(false);
    setSearchExpanded(false);
  }, [pathname]);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(timer);
  }, [q]);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  useEffect(() => {
    if (searchExpanded) inputRef.current?.focus();
  }, [searchExpanded]);

  const sugg = useQuery({
    queryKey: ["search-suggest", debounced],
    queryFn: () => jikan.search({ q: debounced, limit: 8 }),
    enabled: open && debounced.length >= 2,
    staleTime: 60_000,
  });
  const results = sugg.data?.data?.slice(0, 6) ?? [];
  const isAdmin = useQuery({
    queryKey: ["is-admin-nav", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase.from("user_roles").select("id").eq("user_id", user.id).eq("role", "admin").maybeSingle();
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
  const activeLink = (to: string) => to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);
  const search = () => {
    if (!q.trim()) return;
    navigate({ to: "/browse", search: { q: q.trim() } });
    setOpen(false);
    setSearchExpanded(false);
  };

  return (
    <>
      <header className="site-header" data-scrolled={scrolled}>
        <div className="site-nav-surface liquid-glass">
          <div className="site-nav-row">
            <Link to="/" aria-label="AniEra home" className="site-brand">
              <span className="site-brand-mark" aria-hidden="true">A</span>
              <span className="font-display text-sm font-bold sm:text-base">AniEra</span>
            </Link>
            <nav aria-label="Primary" className="site-desktop-links">
              {links.map(link => (
                <Button asChild variant="ghost" className="site-nav-link" key={link.to}>
                  <Link to={link.to} aria-current={activeLink(link.to) ? "page" : undefined}>{link.label}</Link>
                </Button>
              ))}
            </nav>
            <div ref={wrapRef} className="site-search" data-expanded={searchExpanded}>
              <form role="search" onSubmit={event => { event.preventDefault(); search(); }} className="site-search-field">
                <Search size={18} aria-hidden="true" className="shrink-0 text-muted-foreground" />
                <input ref={inputRef} type="search" value={q} onChange={event => { setQ(event.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={event => { if (event.key === "Escape") { setOpen(false); setSearchExpanded(false); } }} placeholder="Search anime…" aria-label="Search anime" aria-controls={open && debounced.length >= 2 ? "anime-search-results" : undefined} className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
                <Button variant="ghost" size="icon" type="submit" aria-label="Submit search" className="h-11 w-11 shrink-0"><ArrowRight aria-hidden="true" /></Button>
              </form>
              {open && debounced.length >= 2 && (
                <div id="anime-search-results" className="site-search-results">
                  {sugg.isPending && <p role="status" className="p-4 text-sm text-muted-foreground">Searching…</p>}
                  {sugg.isError && <p role="status" className="p-4 text-sm text-muted-foreground">Search is unavailable. Try again shortly.</p>}
                  {!sugg.isPending && !sugg.isError && results.length === 0 && <p role="status" className="p-4 text-sm text-muted-foreground">No matches found.</p>}
                  {results.map(anime => (
                    <Link key={anime.mal_id} to="/anime/$id" params={{ id: String(anime.mal_id) }} onClick={() => { setOpen(false); setQ(""); }} className="flex min-h-16 items-center gap-3 px-3 py-2 hover:bg-muted focus-visible:bg-muted">
                      <img src={anime.images.webp?.image_url || anime.images.jpg.image_url} alt="" width={36} height={48} className="h-12 w-9 shrink-0 rounded-md object-cover" />
                      <div className="min-w-0"><div className="truncate text-sm text-foreground">{bestTitle(anime)}</div><div className="truncate text-xs text-muted-foreground">{[anime.type, anime.year, anime.score ? `★ ${anime.score.toFixed(1)}` : null].filter(Boolean).join(" · ")}</div></div>
                    </Link>
                  ))}
                  {results.length > 0 && <Button variant="ghost" onClick={search} className="w-full justify-between rounded-none border-t border-border text-xs">All results <ArrowRight aria-hidden="true" /></Button>}
                </div>
              )}
            </div>
            <div className="site-nav-actions">
              <Button variant="ghost" size="icon" className="site-search-toggle" aria-label={searchExpanded ? "Close search" : "Open search"} aria-expanded={searchExpanded} onClick={() => { setSearchExpanded(value => !value); setOpen(false); }}>{searchExpanded ? <X aria-hidden="true" /> : <Search aria-hidden="true" />}</Button>
              <ThemeControl />
              <Button asChild variant="ghost" size="icon" className="site-profile-link">
                {signedIn ? <Link to="/profile" aria-label="Profile" title="Profile"><UserRound aria-hidden="true" /></Link> : <Link to="/auth" aria-label="Sign in" title="Sign in"><UserRound aria-hidden="true" /></Link>}
              </Button>
            </div>
          </div>
        </div>
      </header>
      <nav aria-label="Mobile primary" className="site-mobile-nav liquid-glass">
        {links.map(link => {
          const Icon = link.icon;
          return <Button asChild variant="ghost" key={link.to} className="site-mobile-link"><Link to={link.to} aria-current={activeLink(link.to) ? "page" : undefined}><Icon aria-hidden="true" /><span>{link.label}</span></Link></Button>;
        })}
      </nav>
    </>
  );
}
