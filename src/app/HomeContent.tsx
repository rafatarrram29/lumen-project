"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import LanguageToggle from "@/components/LanguageToggle";

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-bdr bg-surf p-4 text-start">
      <div className="mb-2 text-xl">{icon}</div>
      <div className="mb-1 text-sm font-semibold text-white">{title}</div>
      <div className="text-xs leading-relaxed text-muted">{description}</div>
    </div>
  );
}

export default function HomeContent({ userEmail }: { userEmail: string }) {
  const { t, dir } = useLanguage();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-4 py-16">
      <div className="pointer-events-none absolute -top-32 start-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-amber/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 end-0 h-72 w-72 rounded-full bg-cyan/10 blur-3xl" />

      <div className="absolute end-4 top-4">
        <LanguageToggle />
      </div>

      <div className="relative w-full max-w-2xl text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber to-[var(--amber-2)] text-3xl font-bold text-on-accent shadow-lg shadow-amber/20">
          L
        </div>
        <h1 className="mb-3 text-4xl font-semibold tracking-tight sm:text-5xl">{t.common.appName}</h1>
        <p className="mb-2 text-lg font-medium text-amber">{t.common.tagline}</p>
        <p className="mx-auto mb-10 max-w-lg text-base leading-relaxed text-muted">{t.home.tagline}</p>

        <div className="mb-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FeatureCard icon="📈" title={t.home.trendTitle} description={t.home.trendDesc} />
          <FeatureCard icon="🔍" title={t.home.rootCauseTitle} description={t.home.rootCauseDesc} />
          <FeatureCard icon="🎯" title={t.home.decisionsTitle} description={t.home.decisionsDesc} />
        </div>

        <Link
          href="/lumen"
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-amber to-[var(--amber-2)] px-8 py-3.5 text-sm font-semibold text-on-accent shadow-lg shadow-amber/20 transition-opacity hover:opacity-90"
        >
          {t.home.startAnalysis} <span aria-hidden>{dir === "rtl" ? "←" : "→"}</span>
        </Link>

        <p className="mt-6 truncate text-xs text-muted">{userEmail}</p>
      </div>
    </div>
  );
}
