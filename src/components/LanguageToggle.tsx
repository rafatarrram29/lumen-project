"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";

export default function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLanguage();

  return (
    <div className={`inline-flex overflow-hidden rounded-lg border border-bdr text-xs ${className}`}>
      <button
        onClick={() => setLang("en")}
        className={`px-2.5 py-1 transition-colors ${lang === "en" ? "bg-amber/10 text-white" : "text-muted hover:text-white"}`}
      >
        EN
      </button>
      <button
        onClick={() => setLang("ar")}
        className={`px-2.5 py-1 transition-colors ${lang === "ar" ? "bg-amber/10 text-white" : "text-muted hover:text-white"}`}
      >
        عربي
      </button>
    </div>
  );
}
