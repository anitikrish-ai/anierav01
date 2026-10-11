import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  panelStatus,
  unlockPanel,
  lockPanel,
  listApis,
  listLogs,
  listVersions,
  saveApi,
  setApiEnabled,
  deleteApi,
  restoreApi,
  rollbackApi,
  testApi,
  exportApis,
  importApis,
} from "@/lib/apipanel.functions";

export const Route = createFileRoute("/x-api-panel-8f3c2a1b")({
  ssr: false,
  component: PanelPage,
  head: () => ({
    meta: [
      { title: "Private API Console — AniEra" },
      { property: "og:title", content: "Private API Console — AniEra" },
      { property: "og:description", content: "Private AniEra API management console." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: "Private API management console." },
    ],
  }),
});

type Kv = Record<string, string>;

type Draft = {
  id?: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  base_url: string;
  path: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headersText: string;
  queryText: string;
  body_template: string;
  auth_type: "none" | "bearer" | "api_key_header" | "query_key";
  auth_value: string;
  timeout_ms: number;
  enabled: boolean;
  priority: number;
  tagsText: string;
};

const emptyDraft: Draft = {
  slug: "",
  name: "",
  category: "general",
  description: "",
  base_url: "",
  path: "",
  method: "GET",
  headersText: "",
  queryText: "",
  body_template: "",
  auth_type: "none",
  auth_value: "",
  timeout_ms: 10000,
  enabled: true,
  priority: 100,
  tagsText: "",
};

function parseKv(text: string): Kv {
  const out: Kv = {};
  text
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean)
    .forEach(line => {
      const i = line.indexOf(":");
      if (i > 0) out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    });
  return out;
}

function kvToText(kv: unknown): string {
  const o = (kv ?? {}) as Kv;
  return Object.entries(o)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

const input =
  "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/30";
const label = "mb-1 block text-xs font-medium uppercase tracking-wide text-white/50";
const btn =
  "rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-50";

function PanelPage() {
  const status = useServerFn(panelStatus);
  const q = useQuery({ queryKey: ["panel-status"], queryFn: () => status(), retry: false });

  if (q.isLoading) {
    return <Shell><p className="text-white/60">Loading…</p></Shell>;
  }
  return q.data?.unlocked ? <Dashboard /> : <Unlock />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#07070c] px-4 py-10">
      <div className="mx-auto max-w-6xl">{children}</div>
    </div>
  );
}

function Unlock() {
  const unlock = useServerFn(unlockPanel);
  const qc = useQueryClient();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const m = useMutation({
    mutationFn: () => unlock({ data: { password } }),
    onSuccess: r => {
      if (r.ok) qc.invalidateQueries({ queryKey: ["panel-status"] });
      else setError("Incorrect password");
    },
    onError: () => setError("Could not verify — try again"),
  });

  return (
    <Shell>
      <div className="mx-auto mt-16 max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-lg font-semibold text-white">API Console</h1>
        <p className="mt-1 text-sm text-white/50">Enter the panel password to continue.</p>
        <form
          className="mt-5 space-y-3"
          onSubmit={e => {
            e.preventDefault();
            setError("");
            m.mutate();
          }}
        >
          <input
            className={input}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button className={`${btn} w-full bg-white text-black`} disabled={m.isPending}>
            {m.isPending ? "Checking…" : "Unlock"}
          </button>
        </form>
      </div>
    </Shell>
  );
}

function Dashboard() {
  const qc = useQueryClient();
  const fnList = useServerFn(listApis);
  const fnLogs = useServerFn(listLogs);
  const fnVersions = useServerFn(listVersions);
  const fnSave = useServerFn(saveApi);
  const fnToggle = useServerFn(setApiEnabled);
  const fnDelete = useServerFn(deleteApi);
  const fnRestore = useServerFn(restoreApi);
  const fnRollback = useServerFn(rollbackApi);
  const fnTest = useServerFn(testApi);
  const fnExport = useServerFn(exportApis);
  const fnImport = useServerFn(importApis);
  const fnLock = useServerFn(lockPanel);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "enabled" | "disabled" | "deleted">("all");
  const [category, setCategory] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [testResult, setTestResult] = useState<string>("");
  const [sample, setSample] = useState("naruto");
  const [msg, setMsg] = useState("");
  const [versionsFor, setVersionsFor] = useState<string | null>(null);

  const apis = useQuery({
    queryKey: ["apis", search, statusFilter, category],
    queryFn: () =>
      fnList({ data: { search: search || undefined, status: statusFilter, category: category || undefined } }),
    retry: false,
  });
  const logs = useQuery({ queryKey: ["api-logs"], queryFn: () => fnLogs({ data: { limit: 60 } }), retry: false });
  const versions = useQuery({
    queryKey: ["api-versions", versionsFor],
    queryFn: () => fnVersions({ data: { api_id: versionsFor! } }),
    enabled: !!versionsFor,
    retry: false,
  });

  const categories = useMemo(
    () => Array.from(new Set(((apis.data as any[]) ?? []).map(a => a.category))).sort(),
    [apis.data],
  );

  function refresh() {
    qc.invalidateQueries({ queryKey: ["apis"] });
    qc.invalidateQueries({ queryKey: ["api-logs"] });
    qc.invalidateQueries({ queryKey: ["api-versions"] });
  }

  function needPass(): string | null {
    if (!confirmPassword) {
      setMsg("Enter your password in the confirmation box to make changes.");
      return null;
    }
    return confirmPassword;
  }

  function draftToApi(d: Draft) {
    return {
      ...(d.id ? { id: d.id } : {}),
      slug: d.slug,
      name: d.name,
      category: d.category || "general",
      description: d.description || null,
      base_url: d.base_url,
      path: d.path,
      method: d.method,
      headers: parseKv(d.headersText),
      query_params: parseKv(d.queryText),
      body_template: d.body_template || null,
      auth_type: d.auth_type,
      auth_value: d.auth_value || null,
      timeout_ms: Number(d.timeout_ms) || 10000,
      enabled: d.enabled,
      priority: Number(d.priority) || 100,
      tags: d.tagsText.split(",").map(t => t.trim()).filter(Boolean),
    };
  }

  const act = async (fn: () => Promise<any>, ok: string) => {
    setMsg("");
    try {
      await fn();
      setMsg(ok);
      refresh();
    } catch (e: any) {
      setMsg(String(e?.message ?? e));
    }
  };

  return (
    <Shell>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">API Console</h1>
          <p className="text-sm text-white/50">Manage APIs added through this panel only.</p>
        </div>
        <div className="flex gap-2">
          <button
            className={`${btn} bg-white/10 text-white`}
            onClick={() => setDraft({ ...emptyDraft })}
          >
            + New API
          </button>
          <button
            className={`${btn} bg-white/10 text-white`}
            onClick={async () => {
              const data = await fnExport();
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "custom-apis.json";
              a.click();
            }}
          >
            Export
          </button>
          <label className={`${btn} cursor-pointer bg-white/10 text-white`}>
            Import
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const pass = needPass();
                if (!pass) return;
                try {
                  const parsed = JSON.parse(await file.text());
                  const list = Array.isArray(parsed) ? parsed : parsed.apis;
                  await act(
                    () => fnImport({ data: { confirmPassword: pass, apis: list } }),
                    "Imported successfully",
                  );
                } catch (err: any) {
                  setMsg(String(err?.message ?? err));
                }
              }}
            />
          </label>
          <button
            className={`${btn} bg-red-500/20 text-red-200`}
            onClick={async () => {
              await fnLock();
              qc.invalidateQueries({ queryKey: ["panel-status"] });
            }}
          >
            Lock
          </button>
        </div>
      </header>

      <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <label className={label}>Password confirmation (required for every change)</label>
        <input
          className={input}
          type="password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          placeholder="Confirm password"
        />
        {msg && <p className="mt-2 text-sm text-amber-300">{msg}</p>}
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <input className={input} placeholder="Search name, slug, URL" value={search} onChange={e => setSearch(e.target.value)} />
        <select className={input} value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
          <option value="all">All active</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
          <option value="deleted">Deleted</option>
        </select>
        <select className={input} value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {draft && (
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="mb-4 text-sm font-semibold text-white">{draft.id ? "Edit API" : "New API"}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={label}>Name</label><input className={input} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></div>
            <div><label className={label}>Slug</label><input className={input} value={draft.slug} onChange={e => setDraft({ ...draft, slug: e.target.value })} /></div>
            <div><label className={label}>Category</label><input className={input} value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} /></div>
            <div><label className={label}>Tags (comma separated)</label><input className={input} value={draft.tagsText} onChange={e => setDraft({ ...draft, tagsText: e.target.value })} /></div>
            <div className="sm:col-span-2"><label className={label}>Description</label><input className={input} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></div>
            <div><label className={label}>Base URL</label><input className={input} placeholder="https://api.example.com" value={draft.base_url} onChange={e => setDraft({ ...draft, base_url: e.target.value })} /></div>
            <div><label className={label}>Path</label><input className={input} placeholder="/v1/search" value={draft.path} onChange={e => setDraft({ ...draft, path: e.target.value })} /></div>
            <div>
              <label className={label}>Method</label>
              <select className={input} value={draft.method} onChange={e => setDraft({ ...draft, method: e.target.value as Draft["method"] })}>
                {["GET", "POST", "PUT", "PATCH", "DELETE"].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div><label className={label}>Timeout (ms)</label><input className={input} type="number" value={draft.timeout_ms} onChange={e => setDraft({ ...draft, timeout_ms: Number(e.target.value) })} /></div>
            <div>
              <label className={label}>Auth type</label>
              <select className={input} value={draft.auth_type} onChange={e => setDraft({ ...draft, auth_type: e.target.value as Draft["auth_type"] })}>
                <option value="none">None</option>
                <option value="bearer">Bearer token</option>
                <option value="api_key_header">API key header</option>
                <option value="query_key">API key in query</option>
              </select>
            </div>
            <div><label className={label}>Auth value</label><input className={input} type="password" value={draft.auth_value} onChange={e => setDraft({ ...draft, auth_value: e.target.value })} /></div>
            <div><label className={label}>Headers (one per line, key: value)</label><textarea className={`${input} h-24`} value={draft.headersText} onChange={e => setDraft({ ...draft, headersText: e.target.value })} /></div>
            <div><label className={label}>Query params (key: value, use {"{query}"})</label><textarea className={`${input} h-24`} value={draft.queryText} onChange={e => setDraft({ ...draft, queryText: e.target.value })} /></div>
            <div className="sm:col-span-2"><label className={label}>Body template</label><textarea className={`${input} h-20`} value={draft.body_template} onChange={e => setDraft({ ...draft, body_template: e.target.value })} /></div>
            <div><label className={label}>Priority</label><input className={input} type="number" value={draft.priority} onChange={e => setDraft({ ...draft, priority: Number(e.target.value) })} /></div>
            <div className="flex items-end gap-2">
              <input id="en" type="checkbox" checked={draft.enabled} onChange={e => setDraft({ ...draft, enabled: e.target.checked })} />
              <label htmlFor="en" className="text-sm text-white/70">Enabled</label>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input className={`${input} max-w-[200px]`} value={sample} onChange={e => setSample(e.target.value)} placeholder="sample {query}" />
            <button
              className={`${btn} bg-white/10 text-white`}
              onClick={async () => {
                setTestResult("Testing…");
                try {
                  const r = await fnTest({ data: { api: draftToApi(draft) as any, sampleQuery: sample } });
                  setTestResult(`${r.ok ? "OK" : "FAILED"} · ${r.status} · ${r.latency}ms\n${r.url}\n\n${r.body}`);
                } catch (e: any) {
                  setTestResult(String(e?.message ?? e));
                }
              }}
            >
              Test request
            </button>
            <button
              className={`${btn} bg-white text-black`}
              onClick={() => {
                const pass = needPass();
                if (!pass) return;
                act(() => fnSave({ data: { confirmPassword: pass, api: draftToApi(draft) as any } }), "Saved").then(() =>
                  setDraft(null),
                );
              }}
            >
              Save
            </button>
            <button className={`${btn} bg-white/10 text-white`} onClick={() => setDraft(null)}>Cancel</button>
          </div>
          {testResult && (
            <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-black/50 p-3 text-xs text-white/70">{testResult}</pre>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-white/50">
            <tr>
              <th className="p-3">Name</th><th className="p-3">Category</th><th className="p-3">Endpoint</th>
              <th className="p-3">Status</th><th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody className="text-white/80">
            {apis.isLoading && <tr><td className="p-4 text-white/50" colSpan={5}>Loading…</td></tr>}
            {!apis.isLoading && ((apis.data as any[]) ?? []).length === 0 && (
              <tr><td className="p-4 text-white/50" colSpan={5}>No APIs yet — add your first one.</td></tr>
            )}
            {((apis.data as any[]) ?? []).map(a => (
              <tr key={a.id} className="border-t border-white/5 align-top">
                <td className="p-3">
                  <div className="font-medium text-white">{a.name}</div>
                  <div className="text-xs text-white/40">{a.slug}</div>
                </td>
                <td className="p-3 text-xs">{a.category}</td>
                <td className="p-3 text-xs text-white/50">{a.method} {a.base_url}{a.path}</td>
                <td className="p-3 text-xs">
                  <span className={a.enabled ? "text-emerald-400" : "text-white/40"}>
                    {a.deleted_at ? "deleted" : a.enabled ? "enabled" : "disabled"}
                  </span>
                  {a.last_status && <div className="text-white/40">{a.last_status} · {a.last_latency_ms ?? "–"}ms</div>}
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <button className="text-white/70 hover:text-white" onClick={() => setDraft({
                      id: a.id, slug: a.slug, name: a.name, category: a.category, description: a.description ?? "",
                      base_url: a.base_url, path: a.path ?? "", method: a.method, headersText: kvToText(a.headers),
                      queryText: kvToText(a.query_params), body_template: a.body_template ?? "", auth_type: a.auth_type,
                      auth_value: a.auth_value ?? "", timeout_ms: a.timeout_ms, enabled: a.enabled, priority: a.priority,
                      tagsText: (a.tags ?? []).join(", "),
                    })}>Edit</button>
                    <button className="text-white/70 hover:text-white" onClick={() => {
                      const pass = needPass(); if (!pass) return;
                      act(() => fnToggle({ data: { confirmPassword: pass, id: a.id, enabled: !a.enabled } }), "Updated");
                    }}>{a.enabled ? "Disable" : "Enable"}</button>
                    <button className="text-white/70 hover:text-white" onClick={() => setVersionsFor(versionsFor === a.id ? null : a.id)}>History</button>
                    {a.deleted_at ? (
                      <button className="text-emerald-300" onClick={() => {
                        const pass = needPass(); if (!pass) return;
                        act(() => fnRestore({ data: { confirmPassword: pass, id: a.id } }), "Restored");
                      }}>Restore</button>
                    ) : (
                      <button className="text-red-300" onClick={() => {
                        const pass = needPass(); if (!pass) return;
                        act(() => fnDelete({ data: { confirmPassword: pass, id: a.id, permanent: false } }), "Moved to deleted");
                      }}>Delete</button>
                    )}
                    {a.deleted_at && (
                      <button className="text-red-400" onClick={() => {
                        const pass = needPass(); if (!pass) return;
                        if (!confirm("Permanently remove this API?")) return;
                        act(() => fnDelete({ data: { confirmPassword: pass, id: a.id, permanent: true } }), "Removed permanently");
                      }}>Purge</button>
                    )}
                  </div>
                  {versionsFor === a.id && (
                    <div className="mt-2 space-y-1 text-xs text-white/50">
                      {versions.isLoading && <div>Loading history…</div>}
                      {((versions.data as any[]) ?? []).map(v => (
                        <div key={v.id} className="flex items-center gap-2">
                          <span>{new Date(v.created_at).toLocaleString()} · {v.reason}</span>
                          <button className="text-white/70 hover:text-white" onClick={() => {
                            const pass = needPass(); if (!pass) return;
                            act(() => fnRollback({ data: { confirmPassword: pass, version_id: v.id } }), "Rolled back");
                          }}>Roll back</button>
                        </div>
                      ))}
                      {!versions.isLoading && ((versions.data as any[]) ?? []).length === 0 && <div>No history yet.</div>}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">Activity log</h2>
        <div className="max-h-72 space-y-1 overflow-auto text-xs text-white/50">
          {((logs.data as any[]) ?? []).map(l => (
            <div key={l.id}>
              {new Date(l.created_at).toLocaleString()} · {l.action} · {l.api_slug ?? "—"} ·{" "}
              <span className={l.ok === false ? "text-red-300" : "text-emerald-300"}>
                {l.ok === false ? "failed" : "ok"}
              </span>
              {l.status_code ? ` · ${l.status_code}` : ""}{l.latency_ms ? ` · ${l.latency_ms}ms` : ""}
              {l.message ? ` · ${l.message}` : ""}
            </div>
          ))}
          {((logs.data as any[]) ?? []).length === 0 && <div>No activity yet.</div>}
        </div>
      </div>
    </Shell>
  );
}
