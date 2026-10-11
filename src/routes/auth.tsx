import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [
      { name: "description", content: "Sign in to AniEra to sync your anime library and viewing progress." },
      { property: "og:title", content: "Sign in — AniEra" },
      { property: "og:description", content: "Sign in to AniEra to sync your anime library and viewing progress." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },{ title: "Sign in — AniEra" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/library" });
    });
  }, [navigate]);

  const onGoogle = async () => {
    setBusy(true);
    const { error } = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/library" });
    if (error) { toast.error(error.message); setBusy(false); }
  };

  const onEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: window.location.origin + "/library",
            data: { full_name: name || undefined },
          },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
        navigate({ to: "/library" });
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md py-10">
      <div className="glass-strong rounded-3xl p-6 sm:p-8">
        <h1 className="font-display text-2xl font-bold text-white">
          {mode === "signin" ? "Sign in to AniEra" : "Create your AniEra account"}
        </h1>
        <p className="mt-1 text-sm text-white/60">
          Sync your library, favorites and watch history across devices.
        </p>

        <button
          onClick={onGoogle}
          disabled={busy}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-background hover:bg-white/90 disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6 8-11.3 8a12 12 0 1 1 7.9-21l5.6-5.6A20 20 0 1 0 44 24c0-1.2-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8A12 12 0 0 1 24 12c3 0 5.8 1.1 7.9 3l5.6-5.6A20 20 0 0 0 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.7-3.3-11.3-8l-6.5 5A20 20 0 0 0 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.6l6.2 5.2c-.4.4 6.5-4.8 6.5-14.8 0-1.2-.1-2.3-.4-3.5z"/></svg>
          Continue with Google
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-white/40">
          <div className="h-px flex-1 bg-white/10" /> or <div className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={onEmail} className="space-y-3">
          {mode === "signup" && (
            <input
              type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Display name (optional)"
              maxLength={80}
              className="w-full rounded-xl bg-white/5 px-4 py-2.5 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-neon-cyan"
            />
          )}
          <input
            type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Email"
            maxLength={255}
            className="w-full rounded-xl bg-white/5 px-4 py-2.5 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-neon-cyan"
          />
          <input
            type="password" required value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Password" minLength={6} maxLength={128}
            className="w-full rounded-xl bg-white/5 px-4 py-2.5 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-neon-cyan"
          />
          <button
            type="submit" disabled={busy}
            className="w-full rounded-xl bg-gradient-to-r from-neon-cyan to-neon-magenta px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50"
          >
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          onClick={() => setMode(m => (m === "signin" ? "signup" : "signin"))}
          className="mt-4 w-full text-center text-xs text-white/60 hover:text-white"
        >
          {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>

        <p className="mt-6 text-center text-[11px] text-white/40">
          Already imported your list? Visit your <Link to="/library" className="underline">library</Link>.
        </p>
      </div>
    </div>
  );
}