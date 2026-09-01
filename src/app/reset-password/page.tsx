"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import LanguageToggle from "@/components/LanguageToggle";

export default function ResetPasswordPage() {
  const { t } = useLanguage();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setDone(true);
    setLoading(false);
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

        {done ? (
          <>
            <h1 className="mb-1 text-xl font-semibold">{t.resetPassword.successTitle}</h1>
            <p className="mb-6 text-sm text-muted">{t.resetPassword.successBody}</p>
            <Link
              href="/"
              className="block w-full rounded-lg bg-gradient-to-br from-amber to-[var(--amber-2)] py-2.5 text-center text-sm font-semibold text-on-accent transition-opacity hover:opacity-90"
            >
              {t.resetPassword.continueToApp}
            </Link>
          </>
        ) : (
          <>
            <h1 className="mb-1 text-xl font-semibold">{t.resetPassword.title}</h1>
            <p className="mb-6 text-sm text-muted">{t.resetPassword.subtitle}</p>
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">
                  {t.resetPassword.newPassword}
                </label>
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

              {error && <p className="text-sm text-red">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-gradient-to-br from-amber to-[var(--amber-2)] py-2.5 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {loading ? t.login.pleaseWait : t.resetPassword.updateButton}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
