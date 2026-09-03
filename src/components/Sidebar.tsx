"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { useInstall } from "./InstallPrompt";
import LanguageToggle from "./LanguageToggle";
import ThemeToggle from "./ThemeToggle";

export default function Sidebar({
  userEmail,
  children,
}: {
  userEmail: string;
  children?: ReactNode;
}) {
  const { t } = useLanguage();
  const { isStandalone, openModal } = useInstall();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-bdr bg-surf p-4 sm:w-72 sm:border-b-0 sm:border-e">
      <div className="mb-6 flex items-center justify-between gap-2">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber to-[var(--amber-2)] font-bold text-on-accent">
            L
          </div>
          <div className="min-w-0">
            <div className="truncate font-semibold leading-tight">{t.common.appName}</div>
            <div className="truncate text-xs leading-tight text-muted">{t.common.tagline}</div>
          </div>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <LanguageToggle />
        </div>
      </div>

      {children}

      <div className="mt-4 border-t border-bdr pt-4">
        {!isStandalone && (
          <button
            onClick={openModal}
            className="mb-3 flex items-center gap-1.5 text-sm text-muted hover:text-white"
          >
            <span aria-hidden>⊕</span>
            {t.install.sidebarLink}
          </button>
        )}
        <div className="mb-2 truncate text-xs text-muted">{userEmail}</div>
        <button onClick={handleLogout} className="text-sm text-muted hover:text-red">
          {t.common.signOut}
        </button>
      </div>
    </aside>
  );
}
