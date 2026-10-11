import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProxyChooser } from "@/components/ProxyChooser";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Navbar } from "../components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "sonner";
import { useApplySiteSettings } from "@/lib/site-settings";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: import("@tanstack/react-router").ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => {
    const gaId = import.meta.env.VITE_GA_ID as string | undefined;
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: "AniEra — Anime Streaming, Seasonal Anime 2026, Sub & Dub" },
        { name: "description", content: "AniEra is a premium anime streaming hub: trending and seasonal anime 2026, episode tracker, sub and dub playback, all wrapped in a frosted-glass UI built for fans." },
        { name: "author", content: "AniEra" },
        { name: "theme-color", content: "#0A0A14" },
        { property: "og:title", content: "AniEra — Anime Streaming, Seasonal Anime 2026, Sub & Dub" },
        { property: "og:description", content: "AniEra is a premium anime streaming hub: trending and seasonal anime 2026, episode tracker, sub and dub playback, all wrapped in a frosted-glass UI built for fans." },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "AniEra" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:site", content: "@AniEra" },
        { name: "twitter:title", content: "AniEra — Anime Streaming, Seasonal Anime 2026, Sub & Dub" },
        { name: "twitter:description", content: "AniEra is a premium anime streaming hub: trending and seasonal anime 2026, episode tracker, sub and dub playback, all wrapped in a frosted-glass UI built for fans." },
      ],
      links: [
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap",
        },
        { rel: "preload", href: "/fonts/animeace-bld.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
        { rel: "preload", href: "/fonts/animeace-reg.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
        { rel: "stylesheet", href: appCss },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "AniEra",
            url: "https://aniera.lovable.app",
            potentialAction: {
              "@type": "SearchAction",
              target: "https://aniera.lovable.app/browse?q={search_term_string}",
              "query-input": "required name=search_term_string",
            },
          }),
        },
        ...(gaId
          ? [
              { src: `https://www.googletagmanager.com/gtag/js?id=${gaId}`, async: true },
              {
                children: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`,
              },
            ]
          : []),
      ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <SiteChrome />
    </QueryClientProvider>
  );
}

function SiteChrome() {
  useApplySiteSettings();
  const pathname = useRouterState({ select: s => s.location.pathname });
  const standalone = pathname.startsWith("/x-api-panel-");

  if (standalone) {
    return (
      <>
        <Outlet />
        <Toaster theme="dark" position="top-right" richColors />
      </>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="site-bg-layer" />
      <div className="site-bg-overlay" />
      <a href="#main" className="skip-link">Skip to content</a>
      <Navbar />
      <main id="main" tabIndex={-1} className="has-tabbar mx-auto max-w-7xl px-4 pb-20 pt-4 sm:px-6">
        <Outlet />
      </main>
      <footer className="has-tabbar space-y-3 border-t border-white/5 py-8 text-center text-xs text-white/40">
        <ProxyChooser />
        <div>AniEra · Powered by Jikan, VidNest & MegaPlay · Streams are embedded from third-party sources.</div>
      </footer>
      <Toaster theme="dark" position="top-right" richColors />
    </div>
  );
}
