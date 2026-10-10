import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

type Theme = "system" | "light" | "dark";
const themes: Theme[] = ["system", "light", "dark"];

export function ThemeControl() {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("aniera:theme");
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch { /* System appearance works when storage is unavailable. */ }
  }, []);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () => {
      document.documentElement.dataset.theme = theme === "system" ? (mq.matches ? "light" : "dark") : theme;
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
  const Icon = theme === "system" ? Monitor : theme === "light" ? Sun : Moon;
  return (
    <Button variant="ghost" size="icon" className="glass-press min-h-11 min-w-11 shrink-0 rounded-full" aria-label={`Appearance: ${theme}. Change appearance`} title={`Appearance: ${theme}`} onClick={() => {
      const next = themes[(themes.indexOf(theme) + 1) % themes.length];
      setTheme(next);
      try { localStorage.setItem("aniera:theme", next); } catch { /* Non-persistent preference is still usable. */ }
    }}>
      <Icon aria-hidden="true" />
    </Button>
  );
}