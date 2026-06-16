import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://aniera.lovable.app";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const staticEntries: SitemapEntry[] = [
          { path: "/", changefreq: "daily", priority: "1.0" },
          { path: "/browse", changefreq: "daily", priority: "0.9" },
          { path: "/schedule", changefreq: "daily", priority: "0.8" },
          { path: "/library", changefreq: "weekly", priority: "0.5" },
        ];

        // Pull top-airing anime so detail pages are discoverable.
        const dynamic: SitemapEntry[] = [];
        try {
          const r = await fetch("https://api.jikan.moe/v4/top/anime?filter=airing&limit=25");
          if (r.ok) {
            const j: any = await r.json();
            for (const a of j?.data ?? []) {
              if (a?.mal_id) dynamic.push({ path: `/anime/${a.mal_id}`, changefreq: "weekly", priority: "0.7" });
            }
          }
        } catch {
          // Sitemap should still ship even if Jikan is unreachable.
        }

        const urls = [...staticEntries, ...dynamic].map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ].filter(Boolean).join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
