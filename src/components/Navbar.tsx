import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { GlassButton, GlassCard } from "@zakisheriff/liquid-glass";
import { useAuth } from "@/lib/auth";
import { jikan, bestTitle } from "@/lib/jikan";
import { supabase } from "@/integrations/supabase/client";
import { ThemeControl } from "@/components/ThemeControl";
import {
  Home,
  Compass,
  CalendarDays,
  Library,
  Shield,
  Search,
  X,
  UserRound,
  ArrowRight,
  Menu,
} from "lucide-react";

export function Navbar() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, signedIn } = useAuth();
  const [q, setQ] = useState("");
  const [openSearch, setOpenSearch] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
    setOpenSearch(false);
    setSearchExpanded(false);
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpenSearch(false);
      }
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
    enabled: openSearch && debounced.length >= 2,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  const results = sugg.data?.data?.slice(0, 6) ?? [];

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

  const activeLink = (to: string) =>
    to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);

  const search = () => {
    if (!q.trim()) return;
    navigate({ to: "/browse", search: { q: q.trim() } });
    setOpenSearch(false);
    setSearchExpanded(false);
  };

  return (
    <header className="site-header" data-scrolled={scrolled}>
      {/* Explicit bar positioning and CSS-only frosting: no duplicate bars or SVG displacement collisions */}
      <div className="site-nav-surface">
        <div className="site-nav-row">
          {/* Logo / Brand */}
          <Link to="/" preload="intent" aria-label="AniEra home" className="site-brand group">
            <span
              className="site-brand-mark transition-transform duration-200 group-hover:scale-105"
              aria-hidden="true"
            >
              A
            </span>
            <span className="text-base sm:text-lg font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-white to-purple-400 bg-clip-text text-transparent">
              AniEra
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav aria-label="Main navigation" className="hidden md:flex site-nav-links ml-3">
            {links.map((link) => {
              const active = activeLink(link.to);
              const Icon = link.icon;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  preload="intent"
                  className="site-nav-link"
                  aria-current={active ? "page" : undefined}
                >
                  <Icon
                    size={15}
                    className={active ? "text-primary" : "text-muted-foreground/80"}
                  />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Search bar (desktop inline, mobile popup) */}
          <div ref={wrapRef} className="site-search" data-expanded={searchExpanded}>
            <form
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                search();
              }}
              className="site-search-field"
            >
              <Search
                size={15}
                aria-hidden="true"
                className="shrink-0 text-muted-foreground/80 ml-1"
              />
              <input
                ref={inputRef}
                type="search"
                value={q}
                onChange={(event) => {
                  setQ(event.target.value);
                  setOpenSearch(true);
                }}
                onFocus={() => setOpenSearch(true)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setOpenSearch(false);
                    setSearchExpanded(false);
                  }
                }}
                placeholder="Search anime..."
                aria-label="Search anime"
                autoComplete="off"
                spellCheck="false"
                aria-controls={
                  openSearch && debounced.length >= 2 ? "anime-search-results" : undefined
                }
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 border-0 outline-none focus:outline-none focus:ring-0 shadow-none px-1.5 py-1"
              />
              {q.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setQ("");
                    setDebounced("");
                    inputRef.current?.focus();
                  }}
                  aria-label="Clear search query"
                  className="p-1 mr-0.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors focus:outline-none"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              )}
              <GlassButton
                variant="clear"
                size="sm"
                type="submit"
                aria-label="Submit search"
                icon={<ArrowRight size={14} aria-hidden="true" />}
              />
            </form>

            {openSearch && debounced.length >= 2 && (
              <div id="anime-search-results" className="site-search-results anim-pop">
                {sugg.isPending && (
                  <p role="status" className="p-4 text-sm text-muted-foreground">
                    Searching...
                  </p>
                )}
                {sugg.isError && (
                  <p role="status" className="p-4 text-sm text-muted-foreground">
                    Search is unavailable. Try again shortly.
                  </p>
                )}
                {!sugg.isPending && !sugg.isError && results.length === 0 && (
                  <p role="status" className="p-4 text-sm text-muted-foreground">
                    No matches found.
                  </p>
                )}
                {results.map((anime) => (
                  <Link
                    key={anime.mal_id}
                    to="/anime/$id"
                    params={{ id: String(anime.mal_id) }}
                    preload="intent"
                    onClick={() => {
                      setOpenSearch(false);
                      setQ("");
                    }}
                    className="flex min-h-16 items-center gap-3 px-3 py-2 hover:bg-white/5 transition-colors focus-visible:bg-white/5"
                  >
                    <img
                      src={anime.images.webp?.image_url || anime.images.jpg.image_url}
                      alt=""
                      width={36}
                      height={48}
                      className="h-12 w-9 shrink-0 rounded-md object-cover"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">
                        {bestTitle(anime)}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {[
                          anime.type,
                          anime.year,
                          anime.score ? `★ ${anime.score.toFixed(1)}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                  </Link>
                ))}
                {results.length > 0 && (
                  <button
                    onClick={search}
                    className="w-full flex items-center justify-between px-4 py-2 border-t border-border text-xs font-medium text-primary hover:bg-white/5 transition-colors"
                  >
                    <span>All results for "{debounced}"</span>
                    <ArrowRight size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="site-nav-actions">
            {/* Mobile search toggle: strictly hidden on desktop */}
            <div className="md:hidden shrink-0 flex items-center">
              <GlassButton
                variant="clear"
                size="md"
                className="site-search-toggle"
                aria-label={searchExpanded ? "Close search" : "Open search"}
                aria-expanded={searchExpanded}
                icon={
                  searchExpanded ? (
                    <X size={18} aria-hidden="true" />
                  ) : (
                    <Search size={18} aria-hidden="true" />
                  )
                }
                onClick={() => {
                  setSearchExpanded((value) => !value);
                  setOpenSearch(false);
                }}
              />
            </div>

            {/* Appearance / Theme Control */}
            <ThemeControl />

            {/* Profile / Sign In */}
            <GlassButton
              variant="clear"
              size="md"
              className="site-profile-link shrink-0"
              aria-label={signedIn ? "Profile" : "Sign in"}
              title={signedIn ? "Profile" : "Sign in"}
              icon={<UserRound size={18} aria-hidden="true" />}
              onClick={() => navigate({ to: signedIn ? "/profile" : "/auth" })}
            />

            {/* Mobile menu toggle: strictly hidden on desktop */}
            <div className="md:hidden shrink-0 flex items-center">
              <GlassButton
                variant="clear"
                size="md"
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileMenuOpen}
                icon={
                  mobileMenuOpen ? (
                    <X size={18} aria-hidden="true" />
                  ) : (
                    <Menu size={18} aria-hidden="true" />
                  )
                }
                onClick={() => setMobileMenuOpen((v) => !v)}
              />
            </div>
          </div>
        </div>

        {/* Mobile dropdown menu (stays inside the single header container) */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 px-3 py-3 space-y-1.5 anim-drop">
            {links.map((link) => {
              const active = activeLink(link.to);
              const Icon = link.icon;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  preload="intent"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-3 min-h-[46px] rounded-xl text-sm font-medium transition active:scale-[0.98] ${
                    active
                      ? "bg-primary text-white font-semibold shadow-md shadow-primary/20"
                      : "text-white/80 hover:text-white hover:bg-white/5"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon size={18} className={active ? "text-white" : "text-muted-foreground"} />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
}
