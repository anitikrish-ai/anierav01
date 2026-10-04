import { useEffect, useState, useCallback } from "react";

const KEY = "aniera:proxy";
const EVT = "aniera:proxy-change";

export function readProxyPref(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY) || null;
  } catch {
    return null;
  }
}

export function writeProxyPref(id: string | null) {
  try {
    if (id) window.localStorage.setItem(KEY, id);
    else window.localStorage.removeItem(KEY);
  } catch { /* storage blocked */ }
  window.dispatchEvent(new CustomEvent(EVT, { detail: id }));
}

/** Reactive proxy choice shared across the whole site (works for guests). */
export function useProxyPref() {
  const [proxyId, setLocal] = useState<string | null>(null);
  useEffect(() => {
    setLocal(readProxyPref());
    const on = () => setLocal(readProxyPref());
    window.addEventListener(EVT, on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener(EVT, on);
      window.removeEventListener("storage", on);
    };
  }, []);
  const set = useCallback((id: string | null) => writeProxyPref(id), []);
  return [proxyId, set] as const;
}
