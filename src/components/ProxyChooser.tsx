import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listProxyEndpoints,
  getProxyPreference,
  setProxyPreference,
  verifyProxy,
} from "@/lib/proxy.functions";
import { useProxyPref } from "@/lib/proxy-pref";

/** Site-wide relay picker. Guests: saved locally. Signed-in: synced to profile. */
export function ProxyChooser() {
  const listFn = useServerFn(listProxyEndpoints);
  const getFn = useServerFn(getProxyPreference);
  const setFn = useServerFn(setProxyPreference);
  const verifyFn = useServerFn(verifyProxy);
  const [proxyId, setProxyId] = useProxyPref();
  const [signedIn, setSignedIn] = useState(false);
  const [checking, setChecking] = useState(false);
  const synced = useRef(false);

  const proxies = useQuery({ queryKey: ["proxy-list"], queryFn: () => listFn(), staleTime: 300_000 });

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session || synced.current) return;
      synced.current = true;
      setSignedIn(true);
      try {
        const r = await getFn();
        if (r.proxyId) setProxyId(r.proxyId);
      } catch { /* keep local */ }
    });
  }, [getFn, setProxyId]);

  // Drop a stale choice if the admin disabled that relay.
  useEffect(() => {
    if (proxyId && proxies.data && !proxies.data.some(p => p.id === proxyId)) setProxyId(null);
  }, [proxyId, proxies.data, setProxyId]);

  const change = async (id: string | null) => {
    setProxyId(id);
    if (signedIn) {
      try { await setFn({ data: { proxyId: id } }); } catch (e: any) { toast.error(e?.message ?? "Could not save"); }
    }
    toast.success(id ? "Proxy relay selected" : "Direct connection selected");
  };

  const verify = async () => {
    setChecking(true);
    try {
      const r = await verifyFn({ data: { proxyId } });
      if (r.seenIp) toast.success(`Providers see: ${r.seenIp}${r.viaProxy ? ` (via ${r.viaProxy})` : " (server)"}`);
      else toast.error("Relay did not respond");
    } catch (e: any) {
      toast.error(e?.message ?? "Check failed");
    } finally {
      setChecking(false);
    }
  };

  if (!proxies.data?.length) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-white/60">
      <Globe className="h-3.5 w-3.5" />
      <label htmlFor="proxy-select">Connection:</label>
      <select
        id="proxy-select"
        value={proxyId ?? ""}
        onChange={e => change(e.target.value || null)}
        className="rounded-md border border-white/10 bg-background px-2 py-1 text-white"
      >
        <option value="">Direct (server)</option>
        {proxies.data.map(p => (
          <option key={p.id} value={p.id}>
            {p.label}{p.region ? ` · ${p.region}` : ""}{p.display_ip ? ` · ${p.display_ip}` : ""}
          </option>
        ))}
      </select>
      <button onClick={verify} disabled={checking} className="rounded-md bg-white/10 px-2 py-1 text-white hover:bg-white/20 disabled:opacity-50">
        {checking ? "Checking…" : "Check IP"}
      </button>
    </div>
  );
}
