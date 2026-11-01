import { useEffect, useRef, useState } from "react";
import { GlassButton, GlassCard, GlassSegmented } from "@zakisheriff/liquid-glass";
import { Monitor, Moon, Sun, Sparkles, Turtle, CircleSlash, Settings2 } from "lucide-react";

type Theme = "system" | "light" | "dark";
type Motion = "system" | "reduced" | "playful" | "off";

const themeOptions: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];
const motionOptions: { value: Motion; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "reduced", label: "Calm", icon: Turtle },
  { value: "playful", label: "Playful", icon: Sparkles },
  { value: "off", label: "Off", icon: CircleSlash },
];

function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (saved && (allowed as readonly string[]).includes(saved)) return saved as T;
  } catch {
    /* Storage may be unavailable; defaults still work. */
  }
  return fallback;
}

export function ThemeControl() {
  const [theme, setTheme] = useState<Theme>("system");
  const [motion, setMotion] = useState<Motion>("system");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setTheme(readStored<Theme>("aniera:theme", ["system", "light", "dark"], "system"));
    setMotion(
      readStored<Motion>("aniera:motion", ["system", "reduced", "playful", "off"], "system"),
    );
  }, []);

  // Apply theme; "system" tracks the device appearance.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (mq.matches ? "light" : "dark") : theme;
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  // Apply motion mode; "system" respects the device's reduced-motion setting.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      const resolved = motion === "system" ? (mq.matches ? "reduced" : "standard") : motion;
      document.documentElement.dataset.motion = resolved;
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [motion]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const esc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const pickTheme = (next: Theme) => {
    setTheme(next);
    try {
      localStorage.setItem("aniera:theme", next);
    } catch {
      /* Non-persistent preference is still usable. */
    }
  };
  const pickMotion = (next: Motion) => {
    setMotion(next);
    try {
      localStorage.setItem("aniera:motion", next);
    } catch {
      /* Non-persistent preference is still usable. */
    }
  };

  return (
    <div ref={wrapRef} className="site-theme-control relative inline-flex items-center shrink-0">
      <GlassButton
        variant="clear"
        size="md"
        icon={<Settings2 size={18} aria-hidden="true" />}
        className="site-theme-trigger shrink-0"
        aria-label="Appearance and animation settings"
        aria-expanded={open}
        title="Appearance"
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <div className="site-theme-pop anim-pop absolute right-0 top-[calc(100%+10px)] z-50 w-72 pointer-events-auto">
          <GlassCard
            variant="regular"
            intensity={5}
            padding="14px"
            radius="22px"
            className="w-full shadow-2xl border border-white/10"
            role="dialog"
            aria-label="Appearance and animation"
          >
            <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/90">
              Appearance
            </p>
            <GlassSegmented
              options={themeOptions.map((opt) => ({
                label: opt.label,
                icon: <opt.icon size={13} aria-hidden="true" />,
              }))}
              value={Math.max(
                0,
                themeOptions.findIndex((o) => o.value === theme),
              )}
              onChange={(index) => pickTheme(themeOptions[index]!.value)}
              size="sm"
              intensity={4}
              className="w-full"
              aria-label="Appearance"
            />
            <p className="px-1 pb-2 pt-3.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/90">
              Animation
            </p>
            <GlassSegmented
              options={motionOptions.map((opt) => ({
                label: opt.label,
                icon: <opt.icon size={13} aria-hidden="true" />,
              }))}
              value={Math.max(
                0,
                motionOptions.findIndex((o) => o.value === motion),
              )}
              onChange={(index) => pickMotion(motionOptions[index]!.value)}
              size="sm"
              intensity={4}
              className="w-full"
              aria-label="Animation"
            />
          </GlassCard>
        </div>
      )}
    </div>
  );
}
