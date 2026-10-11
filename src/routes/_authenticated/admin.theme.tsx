import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { saveSiteSettings } from "@/lib/admin.functions";
import { useSiteSettings, type SiteSettings } from "@/lib/site-settings";
import { AdminHeader, AdminCard } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/_authenticated/admin/theme")({
  head: () => ({ meta: [{"title": "Appearance \u2014 AniEra Admin"}, {"name": "description", "content": "Manage AniEra site appearance."}, {"property": "og:title", "content": "Appearance \u2014 AniEra Admin"}, {"property": "og:description", "content": "Manage AniEra site appearance."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary"}, {"name": "robots", "content": "noindex"}] }),
  component: ThemePage,
});

function ThemePage() {
  const settings = useSiteSettings();
  const [form, setForm] = useState<SiteSettings>(settings);
  useEffect(() => { setForm(settings); }, [settings]);

  const save = useServerFn(saveSiteSettings);
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () => save({ data: {
      site_title: form.site_title,
      site_description: form.site_description,
      logo_url: form.logo_url,
      favicon_url: form.favicon_url,
      accent_color: form.accent_color,
      background_image: form.background_image,
      background_overlay: form.background_overlay,
      background_blur: form.background_blur,
      animations_enabled: form.animations_enabled,
      homepage_sections: form.homepage_sections,
      feature_flags: form.feature_flags,
    } }),
    onSuccess: () => {
      toast.success("Theme applied");
      qc.invalidateQueries({ queryKey: ["site_settings"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  // Live preview via CSS vars (without persisting yet)
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--admin-accent", form.accent_color);
    root.style.setProperty("--admin-bg-image", `url("${form.background_image}")`);
    root.style.setProperty("--admin-bg-overlay", String(form.background_overlay));
    root.style.setProperty("--admin-bg-blur", `${form.background_blur}px`);
  }, [form.accent_color, form.background_image, form.background_overlay, form.background_blur]);

  return (
    <>
      <AdminHeader
        title="Theme & Background"
        description="Preview updates instantly. Click save to persist for every visitor."
        actions={
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending}
            className="rounded-lg bg-gradient-to-r from-neon-cyan to-neon-magenta px-4 py-2 text-xs font-semibold text-background disabled:opacity-60"
          >
            {mut.isPending ? "Saving…" : "Save theme"}
          </button>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        <AdminCard>
          <h2 className="font-display text-lg font-bold text-white">Accent color</h2>
          <div className="mt-4 flex items-center gap-3">
            <input
              type="color"
              value={form.accent_color}
              onChange={e => setForm(f => ({ ...f, accent_color: e.target.value }))}
              className="h-12 w-16 cursor-pointer rounded-lg border border-white/10 bg-transparent"
            />
            <input
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              value={form.accent_color}
              onChange={e => setForm(f => ({ ...f, accent_color: e.target.value }))}
            />
          </div>
        </AdminCard>

        <AdminCard>
          <h2 className="font-display text-lg font-bold text-white">Background image</h2>
          <input
            className="mt-4 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            value={form.background_image}
            onChange={e => setForm(f => ({ ...f, background_image: e.target.value }))}
            placeholder="https://…"
          />
          <div
            className="mt-3 h-32 rounded-lg border border-white/10"
            style={{
              backgroundImage: `url("${form.background_image}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        </AdminCard>

        <AdminCard>
          <h2 className="font-display text-lg font-bold text-white">
            Overlay opacity: {(form.background_overlay * 100).toFixed(0)}%
          </h2>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={form.background_overlay}
            onChange={e => setForm(f => ({ ...f, background_overlay: Number(e.target.value) }))}
            className="mt-4 w-full"
          />
        </AdminCard>

        <AdminCard>
          <h2 className="font-display text-lg font-bold text-white">
            Background blur: {form.background_blur}px
          </h2>
          <input
            type="range"
            min={0}
            max={40}
            step={1}
            value={form.background_blur}
            onChange={e => setForm(f => ({ ...f, background_blur: Number(e.target.value) }))}
            className="mt-4 w-full"
          />
        </AdminCard>
      </div>
    </>
  );
}
