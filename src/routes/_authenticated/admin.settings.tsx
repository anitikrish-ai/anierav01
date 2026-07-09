import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { saveSiteSettings } from "@/lib/admin.functions";
import { useSiteSettings, type SiteSettings } from "@/lib/site-settings";
import { AdminHeader, AdminCard } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const settings = useSiteSettings();
  const [form, setForm] = useState<SiteSettings>(settings);
  useEffect(() => { setForm(settings); }, [settings]);

  const save = useServerFn(saveSiteSettings);
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: (payload: SiteSettings) => save({ data: {
      site_title: payload.site_title,
      site_description: payload.site_description,
      logo_url: payload.logo_url,
      favicon_url: payload.favicon_url,
      accent_color: payload.accent_color,
      background_image: payload.background_image,
      background_overlay: payload.background_overlay,
      background_blur: payload.background_blur,
      animations_enabled: payload.animations_enabled,
      homepage_sections: payload.homepage_sections,
      feature_flags: payload.feature_flags,
    } }),
    onSuccess: () => {
      toast.success("Settings saved — live everywhere");
      qc.invalidateQueries({ queryKey: ["site_settings"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  const set = <K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const toggleSection = (key: string) => {
    setForm(f => ({
      ...f,
      homepage_sections: f.homepage_sections.map(s =>
        s.key === key ? { ...s, enabled: !s.enabled } : s,
      ),
    }));
  };

  const moveSection = (idx: number, dir: -1 | 1) => {
    setForm(f => {
      const arr = [...f.homepage_sections];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return f;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return { ...f, homepage_sections: arr };
    });
  };

  return (
    <>
      <AdminHeader
        title="Global Settings"
        description="Site identity, feature toggles, and homepage layout. Saved values apply to every page in real time."
        actions={
          <button
            onClick={() => mut.mutate(form)}
            disabled={mut.isPending}
            className="rounded-lg bg-gradient-to-r from-neon-cyan to-neon-magenta px-4 py-2 text-xs font-semibold text-background disabled:opacity-60"
          >
            {mut.isPending ? "Saving…" : "Save changes"}
          </button>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        <AdminCard>
          <h2 className="font-display text-lg font-bold text-white">Identity</h2>
          <div className="mt-4 space-y-3">
            <Field label="Site title">
              <input
                className="input"
                value={form.site_title}
                onChange={e => set("site_title", e.target.value)}
                maxLength={120}
              />
            </Field>
            <Field label="Site description">
              <textarea
                className="input h-20"
                value={form.site_description}
                onChange={e => set("site_description", e.target.value)}
                maxLength={400}
              />
            </Field>
            <Field label="Logo URL">
              <input
                className="input"
                value={form.logo_url ?? ""}
                onChange={e => set("logo_url", e.target.value || null)}
                placeholder="https://…"
              />
            </Field>
            <Field label="Favicon URL">
              <input
                className="input"
                value={form.favicon_url ?? ""}
                onChange={e => set("favicon_url", e.target.value || null)}
                placeholder="https://…"
              />
            </Field>
          </div>
        </AdminCard>

        <AdminCard>
          <h2 className="font-display text-lg font-bold text-white">
            Feature toggles
          </h2>
          <div className="mt-4 space-y-3">
            <Toggle
              label="Animations"
              checked={form.animations_enabled}
              onChange={v => set("animations_enabled", v)}
            />
          </div>
          <p className="mt-4 text-xs text-white/40">
            More flags can be added via <code>feature_flags</code> JSON.
          </p>
        </AdminCard>

        <AdminCard className="md:col-span-2">
          <h2 className="font-display text-lg font-bold text-white">
            Homepage sections
          </h2>
          <p className="mt-1 text-xs text-white/50">
            Reorder or hide sections. The home page respects this order.
          </p>
          <ul className="mt-4 space-y-2">
            {form.homepage_sections.map((s, i) => (
              <li
                key={s.key}
                className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2"
              >
                <span className="w-10 text-center text-xs text-white/40">
                  {i + 1}
                </span>
                <span className="flex-1 font-medium text-white">{s.label}</span>
                <button
                  onClick={() => moveSection(i, -1)}
                  className="rounded px-2 py-1 text-xs text-white/70 hover:bg-white/10"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveSection(i, 1)}
                  className="rounded px-2 py-1 text-xs text-white/70 hover:bg-white/10"
                >
                  ↓
                </button>
                <Toggle checked={s.enabled} onChange={() => toggleSection(s.key)} />
              </li>
            ))}
          </ul>
        </AdminCard>
      </div>
      <style>{`
        .input { width: 100%; background: rgba(255,255,255,0.06); color: white;
          border: 1px solid rgba(255,255,255,0.1); border-radius: 0.5rem;
          padding: 0.5rem 0.75rem; font-size: 0.875rem; }
        .input:focus { outline: 2px solid rgba(139,92,246,0.6); }
      `}</style>
    </>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wider text-white/50">
        {label}
      </span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3"
    >
      <span
        className={`relative inline-flex h-5 w-9 rounded-full transition ${
          checked ? "bg-neon-cyan" : "bg-white/20"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${
            checked ? "left-4" : "left-0.5"
          }`}
        />
      </span>
      {label && <span className="text-sm text-white/80">{label}</span>}
    </button>
  );
}
