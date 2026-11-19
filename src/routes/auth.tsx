import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      {
        name: "description",
        content: "Sign in to AniEra to sync your anime library and viewing progress.",
      },
      { property: "og:title", content: "Sign in — AniEra" },
      {
        property: "og:description",
        content: "Sign in to AniEra to sync your anime library and viewing progress.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Sign in — AniEra" },
    ],
  }),
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
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/library",
    });
    if (error) {
      toast.error(error.message);
      setBusy(false);
    }
  };

  const onEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
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

  const passwordTooShort = mode === "signup" && password.length > 0 && password.length < 6;

  return (
    <div className="page-enter mx-auto max-w-md py-8 sm:py-12">
      <div className="apple-group rounded-3xl p-6 sm:p-8 space-y-6">
        <header className="space-y-1.5">
          <h1 className="font-display text-2xl font-bold tracking-tight text-white">
            {mode === "signin" ? "Sign in to AniEra" : "Create your AniEra account"}
          </h1>
          <p className="text-sm text-white/60">
            Sync your library, favorites and watch history across devices.
          </p>
        </header>

        <button
          type="button"
          onClick={onGoogle}
          disabled={busy}
          className="flex min-h-[44px] w-full items-center justify-center gap-2.5 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm transition hover:bg-zinc-100 disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path
              fill="#FFC107"
              d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6 8-11.3 8a12 12 0 1 1 7.9-21l5.6-5.6A20 20 0 1 0 44 24c0-1.2-.1-2.3-.4-3.5z"
            />
            <path
              fill="#FF3D00"
              d="m6.3 14.7 6.6 4.8A12 12 0 0 1 24 12c3 0 5.8 1.1 7.9 3l5.6-5.6A20 20 0 0 0 6.3 14.7z"
            />
            <path
              fill="#4CAF50"
              d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.7-3.3-11.3-8l-6.5 5A20 20 0 0 0 24 44z"
            />
            <path
              fill="#1976D2"
              d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.6l6.2 5.2c-.4.4 6.5-4.8 6.5-14.8 0-1.2-.1-2.3-.4-3.5z"
            />
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-3 text-xs text-white/45">
          <div className="h-px flex-1 bg-white/10" />
          <span>or with email</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={onEmail} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <label
                  htmlFor="auth-name"
                  className="text-xs font-semibold uppercase tracking-wider text-white/70"
                >
                  Display Name
                </label>
                <span className="text-[11px] text-white/45">Optional</span>
              </div>
              <input
                id="auth-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="How you appear on reviews"
                maxLength={80}
                className="min-h-[44px] w-full rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="auth-email"
              className="block text-xs font-semibold uppercase tracking-wider text-white/70"
            >
              Email Address
            </label>
            <input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              maxLength={255}
              className="min-h-[44px] w-full rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <label
                htmlFor="auth-password"
                className="text-xs font-semibold uppercase tracking-wider text-white/70"
              >
                Password
              </label>
              <span
                className={`text-[11px] ${
                  passwordTooShort ? "font-medium text-rose-400" : "text-white/45"
                }`}
              >
                Minimum 6 characters
              </span>
            </div>
            <input
              id="auth-password"
              type="password"
              required
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              minLength={6}
              maxLength={128}
              className="min-h-[44px] w-full rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25"
            />
          </div>

          <button
            type="submit"
            disabled={busy || passwordTooShort}
            className="min-h-[44px] w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-45"
          >
            {busy ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div className="border-t border-white/10 pt-4 space-y-2 text-center">
          <button
            type="button"
            onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
            className="min-h-[44px] w-full rounded-xl text-xs font-medium text-sky-400 transition hover:bg-white/[0.04]"
          >
            {mode === "signin"
              ? "New to AniEra? Create an account"
              : "Already have an account? Sign in"}
          </button>
          <p className="text-[11px] text-white/45">
            Already imported your list? Visit your{" "}
            <Link to="/library" className="underline hover:text-white">
              library
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
