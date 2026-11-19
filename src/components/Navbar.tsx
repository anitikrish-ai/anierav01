import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { jikan, bestTitle } from "@/lib/jikan";
import { supabase } from "@/integrations/supabase/client";
import { ThemeControl } from "@/components/ThemeControl";
import { triggerHaptic } from "@/lib/haptics";
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
} from "lucide-react";

export function Navbar() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, signedIn } = useAuth();
  const [q, setQ] = useState("");
  const [openSearch, setOpenSearch] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [debounced, setDebounced] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const toggleBtnRef = useRef<HTMLButtonElement | null>(null);
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
  }, [pathname]);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target) || toggleBtnRef.current?.contains(target)) return;
      setOpenSearch(false);
      setSearchExpanded(false);
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
    triggerHaptic("submit");
    navigate({ to: "/browse", search: { q: q.trim() } });
    setOpenSearch(false);
    setSearchExpanded(false);
  };

  return (
    <header className="site-header anim-nav-in" data-scrolled={scrolled}>
      {/* Single Liquid Glass navbar with CSS-only frosting and pointer specular rim */}
      <div className="site-nav-surface liquid-glass">
        <div className="site-nav-row">
          {/* Logo / Brand */}
          <Link
            to="/"
            preload="intent"
            aria-label="AniEra home"
            onClick={() => triggerHaptic("tap")}
            className="site-brand group"
          >
            <span
              className="site-brand-mark transition-transform duration-200 group-hover:scale-105 group-hover:-rotate-3"
              aria-hidden="true"
            >
              A
            </span>
            <span className="site-brand-text hidden sm:inline text-base sm:text-lg font-bold tracking-tight">
              AniEra
            </span>
          </Link>

          {/* Single Navigation Links: Icon-only on mobile/tablet, Icon + Label on desktop */}
          <nav aria-label="Main navigation" className="site-nav-links sm:ml-1 lg:ml-3">
            {links.map((link) => {
              const active = activeLink(link.to);
              const Icon = link.icon;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  preload="intent"
                  title={link.label}
                  aria-label={link.label}
                  onClick={() => triggerHaptic("tap")}
                  className="site-nav-link"
                  aria-current={active ? "page" : undefined}
                >
                  <Icon
                    size={17}
                    strokeWidth={active ? 2.25 : 1.9}
                    aria-hidden="true"
                    className={active ? "text-primary" : "text-muted-foreground"}
                  />
                  <span className="hidden lg:inline">{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Search bar (inline on md+, frosted dropdown when toggled on mobile) */}
          <div ref={wrapRef} className="site-search" data-expanded={searchExpanded}>
            <form
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                search();
              }}
              className="site-search-field"
            >
              <Search size={15} aria-hidden="true" className="shrink-0 text-muted-foreground/80" />
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
                    triggerHaptic("tap");
                    setQ("");
                    setDebounced("");
                    inputRef.current?.focus();
                  }}
                  aria-label="Clear search query"
                  className="p-1 mr-0.5 rounded-full text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              )}
              <button type="submit" aria-label="Submit search" className="site-search-submit">
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            </form>

            {openSearch && debounced.length >= 2 && (
              <div id="anime-search-results" className="site-search-results anim-pop-tr">
                {sugg.isPending && (
                  <div role="status" aria-label="Searching" className="space-y-2 p-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="h-12 w-9 shrink-0 rounded-md shimmer" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3.5 w-3/4 rounded shimmer" />
                          <div className="h-2.5 w-1/2 rounded shimmer" />
                        </div>
                      </div>
                    ))}
                  </div>
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
                      triggerHaptic("tap");
                      setOpenSearch(false);
                      setSearchExpanded(false);
                      setQ("");
                    }}
                    className="site-search-item flex min-h-16 items-center gap-3 px-3 py-2 transition-colors"
                  >
                    <img
                      src={
                        anime.images?.webp?.image_url ||
                        anime.images?.jpg?.image_url ||
                        anime.images?.jpg?.large_image_url ||
                        ""
                      }
                      alt=""
                      width={36}
                      height={48}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.opacity = "0";
                      }}
                      className="h-12 w-9 shrink-0 rounded-md bg-white/5 object-cover"
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
                    type="button"
                    onClick={search}
                    className="site-search-item w-full flex items-center justify-between px-4 py-2.5 border-t border-border text-xs font-medium text-primary transition-colors"
                  >
                    <span>All results for "{debounced}"</span>
                    <ArrowRight size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right Utility Icons */}
          <div className="site-nav-actions">
            <button
              ref={toggleBtnRef}
              type="button"
              className="site-icon-btn md:hidden"
              aria-label={searchExpanded ? "Close search" : "Open search"}
              aria-expanded={searchExpanded}
              title={searchExpanded ? "Close search" : "Search"}
              onClick={() => {
                triggerHaptic("tap");
                setSearchExpanded((value) => !value);
                setOpenSearch(false);
              }}
            >
              {searchExpanded ? (
                <X size={17} aria-hidden="true" />
              ) : (
                <Search size={17} aria-hidden="true" />
              )}
            </button>

            <ThemeControl
              onOpen={() => {
                setSearchExpanded(false);
                setOpenSearch(false);
              }}
            />

            <Link
              to={signedIn ? "/profile" : "/auth"}
              preload="intent"
              onClick={() => triggerHaptic("tap")}
              className="site-icon-btn"
              aria-label={signedIn ? "Profile" : "Sign in"}
              title={signedIn ? "Profile" : "Sign in"}
              aria-current={pathname === "/profile" || pathname === "/auth" ? "page" : undefined}
            >
              <UserRound size={17} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
