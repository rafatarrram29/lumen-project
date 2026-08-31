"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { translations, type Lang, type Translations } from "./translations";

const STORAGE_KEY = "lumen-lang";

type LanguageContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Translations;
  dir: "ltr" | "rtl";
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      // One-time restore of a persisted preference on mount — localStorage
      // isn't available during SSR, so this can't be a lazy useState
      // initializer without a hydration mismatch.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored === "en" || stored === "ar") setLangState(stored);
    } catch {
      // localStorage unavailable — stay on the default language.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  function setLang(next: Lang) {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Best-effort persistence only.
    }
  }

  const value: LanguageContextValue = {
    lang,
    setLang,
    t: translations[lang],
    dir: lang === "ar" ? "rtl" : "ltr",
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
