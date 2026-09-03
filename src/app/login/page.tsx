"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import LanguageToggle from "@/components/LanguageToggle";

export default function LoginPage() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      window.location.href = "/";
    } else if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?type=signup`,
        },
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      setMessage(t.login.checkEmail);
      setLoading(false);
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      setMessage(t.login.resetLinkSent);
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-2xl border border-bdr bg-surf p-8 shadow-xl">
        <div className="mb-6 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber to-[var(--amber-2)] font-bold text-on-accent">
              L
            </div>
            <div className="text-lg font-semibold">{t.common.appName}</div>
          </div>
          <LanguageToggle />
        </div>

        <h1 className="mb-1 text-xl font-semibold">{mode === "forgot" ? t.login.resetTitle : t.login.title}</h1>
        <p className="mb-6 text-sm text-muted">{mode === "forgot" ? t.login.resetSubtitle : t.login.subtitle}</p>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">{t.login.email}</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full rounded-lg border border-bdr bg-surf2 px-3 py-2.5 text-sm text-white outline-none focus:border-amber"
            />
          </div>
          {mode !== "forgot" && (
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label className="block text-xs font-medium text-muted">{t.login.password}</label>
                {mode === "signin" && (
                  <button
                    type="button"
                    className="text-xs font-medium text-amber"
                    onClick={() => {
                      setMode("forgot");
                      setError(null);
                      setMessage(null);
                    }}
                  >
                    {t.login.forgotPassword}
                  </button>
                )}
              </div>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-bdr bg-surf2 px-3 py-2.5 text-sm text-white outline-none focus:border-amber"
              />
            </div>
          )}

          {error && <p className="text-sm text-red">{error}</p>}
          {message && <p className="text-sm text-green">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gradient-to-br from-amber to-[var(--amber-2)] py-2.5 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {loading
              ? t.login.pleaseWait
              : mode === "signin"
                ? t.login.signIn
                : mode === "signup"
                  ? t.login.createAccount
                  : t.login.sendResetLink}
          </button>
        </form>

        <div className="mt-5 text-center text-sm text-muted">
          {mode === "signin" ? (
            <>
              {t.login.noAccount}{" "}
              <button
                className="font-semibold text-amber"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                  setMessage(null);
                }}
              >
                {t.login.signUpFree}
              </button>
            </>
          ) : mode === "signup" ? (
            <>
              {t.login.haveAccount}{" "}
              <button
                className="font-semibold text-amber"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                  setMessage(null);
                }}
              >
                {t.login.signIn}
              </button>
            </>
          ) : (
            <button
              className="font-semibold text-amber"
              onClick={() => {
                setMode("signin");
                setError(null);
                setMessage(null);
              }}
            >
              {t.login.backToSignIn}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
