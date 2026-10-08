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
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const Icon = theme === "system" ? Monitor : theme === "light" ? Sun : Moon;
  return (
    <Button variant="ghost" size="icon" aria-label={`Appearance: ${theme}. Change appearance`} title={`Appearance: ${theme}`} onClick={() => {
      const next = themes[(themes.indexOf(theme) + 1) % themes.length];
      setTheme(next);
      try { localStorage.setItem("aniera:theme", next); } catch { /* Non-persistent preference is still usable. */ }
    }}>
      <Icon aria-hidden="true" />
    </Button>
  );
}