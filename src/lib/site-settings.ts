import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SiteSettings = {
  id: number;
  site_title: string;
  site_description: string;
  logo_url: string | null;
  favicon_url: string | null;
  accent_color: string;
  background_image: string;
  background_overlay: number;
  background_blur: number;
  homepage_sections: { key: string; label: string; enabled: boolean }[];
  animations_enabled: boolean;
  feature_flags: Record<string, boolean>;
};

const DEFAULTS: SiteSettings = {
  id: 1,
  site_title: "AniEra",
  site_description: "Premium anime streaming hub",
  logo_url: null,
  favicon_url: null,
  accent_color: "#8b5cf6",
  background_image:
    "https://i.pinimg.com/736x/70/a9/09/70a909322b27f1001d5ace42d1821ff0.jpg",
  background_overlay: 0.7,
  background_blur: 0,
  homepage_sections: [
    { key: "hero", label: "Hero", enabled: true },
    { key: "trending", label: "Trending", enabled: true },
    { key: "popular", label: "Popular", enabled: true },
    { key: "latest", label: "Latest", enabled: true },
    { key: "movies", label: "Movies", enabled: true },
    { key: "schedule", label: "Schedule", enabled: true },
  ],
  animations_enabled: true,
  feature_flags: {},
};

async function fetchSettings(): Promise<SiteSettings> {
  const { data, error } = await supabase
    .from("site_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) return DEFAULTS;
  return {
    ...DEFAULTS,
    ...(data as any),
    homepage_sections: Array.isArray((data as any).homepage_sections)
      ? ((data as any).homepage_sections as any)
      : DEFAULTS.homepage_sections,
    feature_flags:
      (data as any).feature_flags && typeof (data as any).feature_flags === "object"
        ? ((data as any).feature_flags as any)
        : {},
  };
}

export function useSiteSettings() {
  const q = useQuery({
    queryKey: ["site_settings"],
    queryFn: fetchSettings,
    staleTime: 30_000,
  });

  // Realtime — invalidate on any change to site_settings row.
  useEffect(() => {
    const ch = supabase
      .channel("site_settings_live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_settings" },
        () => q.refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return q.data ?? DEFAULTS;
}

/** Apply live CSS variables from site_settings (accent color, background). */
export function useApplySiteSettings() {
  const s = useSiteSettings();
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.style.setProperty("--admin-accent", s.accent_color);
    root.style.setProperty(
      "--admin-bg-image",
      `url("${s.background_image}")`,
    );
    root.style.setProperty("--admin-bg-overlay", String(s.background_overlay));
    root.style.setProperty("--admin-bg-blur", `${s.background_blur}px`);
    root.dataset.animations = s.animations_enabled ? "on" : "off";
  }, [s]);
  return s;
}

export { DEFAULTS as DEFAULT_SITE_SETTINGS };
