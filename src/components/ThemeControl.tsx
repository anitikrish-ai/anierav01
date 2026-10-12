import { useEffect, useRef, useState } from "react";
import { Check, Monitor, Moon, Sun, Sparkles, Turtle, CircleSlash, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Theme = "system" | "light" | "dark";
type Motion = "system" | "reduced" | "playful" | "off";

const themeOptions: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];
const motionOptions: { value: Motion; label: string; hint: string; icon: typeof Sun }[] = [
  { value: "system", label: "System", hint: "Follows your device setting", icon: Monitor },
  { value: "reduced", label: "Reduced", hint: "Gentle fades, no bouncing", icon: Turtle },
  { value: "playful", label: "Playful", hint: "Extra bounce and spring", icon: Sparkles },
  { value: "off", label: "Off", hint: "No animation at all", icon: CircleSlash },
];

function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (saved && (allowed as readonly string[]).includes(saved)) return saved as T;
  } catch { /* Storage may be unavailable; defaults still work. */ }
  return fallback;
}

export function ThemeControl() {
  const [theme, setTheme] = useState<Theme>("system");
  const [motion, setMotion] = useState<Motion>("system");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setTheme(readStored("aniera:theme", ["system", "light", "dark"], "system"));
    setMotion(readStored("aniera:motion", ["system", "reduced", "playful", "off"], "system"));
  }, []);

  // Apply theme; "system" tracks the device appearance.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () => {
      document.documentElement.dataset.theme = theme === "system" ? (mq.matches ? "light" : "dark") : theme;
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
    const esc = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const pickTheme = (next: Theme) => {
    setTheme(next);
    try { localStorage.setItem("aniera:theme", next); } catch { /* Non-persistent preference is still usable. */ }
  };
  const pickMotion = (next: Motion) => {
    setMotion(next);
    try { localStorage.setItem("aniera:motion", next); } catch { /* Non-persistent preference is still usable. */ }
  };

  return (
    <div ref={wrapRef} className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="glass-press min-h-11 min-w-11 shrink-0 rounded-full"
        aria-label="Appearance and animation settings"
        aria-expanded={open}
        aria-haspopup="menu"
        title="Appearance"
        onClick={() => setOpen(v => !v)}
      >
        <Settings2 aria-hidden="true" />
      </Button>
      {open && (
        <div
          role="menu"
          aria-label="Appearance and animation"
          className="liquid-glass anim-pop absolute right-0 top-full z-[var(--z-dropdown)] mt-2 w-64 rounded-2xl p-2"
        >
          <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Appearance</p>
          {themeOptions.map(opt => (
            <button
              key={opt.value}
              role="menuitemradio"
              aria-checked={theme === opt.value}
              onClick={() => pickTheme(opt.value)}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-foreground hover:bg-muted focus-visible:bg-muted"
            >
              <opt.icon size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
              <span className="flex-1">{opt.label}</span>
              {theme === opt.value && <Check size={16} aria-hidden="true" className="text-primary" />}
            </button>
          ))}
          <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Animation</p>
          {motionOptions.map(opt => (
            <button
              key={opt.value}
              role="menuitemradio"
              aria-checked={motion === opt.value}
              onClick={() => pickMotion(opt.value)}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-foreground hover:bg-muted focus-visible:bg-muted"
            >
              <opt.icon size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
              <span className="flex-1">
                {opt.label}
                <span className="block text-xs text-muted-foreground">{opt.hint}</span>
              </span>
              {motion === opt.value && <Check size={16} aria-hidden="true" className="text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
