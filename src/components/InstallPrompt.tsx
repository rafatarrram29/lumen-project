"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

const DISMISS_KEY = "lumen-install-banner-dismissed";

// Chrome/Android fire this before showing their own install UI; capturing
// it lets us trigger the native prompt from our own button instead of
// waiting for the browser's address-bar icon. iOS Safari never fires it —
// there, "Add to Home Screen" is a manual Share-menu action we can only
// explain, not trigger.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

type InstallContextValue = {
  isStandalone: boolean;
  isIOS: boolean;
  canPromptNative: boolean;
  promptInstall: () => void;
  showModal: boolean;
  openModal: () => void;
  closeModal: () => void;
};

const InstallContext = createContext<InstallContextValue | null>(null);

export function InstallProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // One-time read of platform/display-mode on mount — both depend on
    // `window`/`navigator`, unavailable during SSR, so this can't be a lazy
    // useState initializer without a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsStandalone(isStandaloneDisplay());
    setIsIOS(isIOSDevice());

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setDeferredPrompt(null);
      setIsStandalone(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function promptInstall() {
    if (!deferredPrompt) {
      setShowModal(true);
      return;
    }
    deferredPrompt.prompt();
    deferredPrompt.userChoice.finally(() => setDeferredPrompt(null));
  }

  const value: InstallContextValue = {
    isStandalone,
    isIOS,
    canPromptNative: deferredPrompt !== null,
    promptInstall,
    showModal,
    openModal: () => setShowModal(true),
    closeModal: () => setShowModal(false),
  };

  return (
    <InstallContext.Provider value={value}>
      {children}
      {!isStandalone && <InstallBanner />}
      {showModal && <InstallInstructionsModal onClose={value.closeModal} />}
    </InstallContext.Provider>
  );
}

export function useInstall(): InstallContextValue {
  const ctx = useContext(InstallContext);
  if (!ctx) throw new Error("useInstall must be used within an InstallProvider");
  return ctx;
}

function InstallBanner() {
  const { t } = useLanguage();
  const { promptInstall } = useInstall();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Best-effort persistence only — worst case the banner reappears.
    }
  }

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-3">
      <div className="flex w-full max-w-xl items-center gap-3 rounded-xl border border-bdr bg-surf px-4 py-3 shadow-lg">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber to-[var(--amber-2)] font-bold text-on-accent">
          L
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white">{t.install.bannerTitle}</div>
          <div className="truncate text-xs text-muted">{t.install.bannerBody}</div>
        </div>
        <button
          type="button"
          onClick={() => {
            dismiss();
            promptInstall();
          }}
          className="shrink-0 rounded-lg bg-amber px-3 py-1.5 text-xs font-semibold text-on-accent hover:opacity-90"
        >
          {t.install.installButton}
        </button>
        <button type="button" onClick={dismiss} className="shrink-0 text-muted hover:text-white">
          ×
        </button>
      </div>
    </div>
  );
}

function InstallInstructionsModal({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-bdr bg-surf p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-white">{t.install.modalTitle}</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-white">
            ×
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-bdr p-3">
          <div className="mb-2 text-sm font-semibold text-white">{t.install.androidTitle}</div>
          <ol className="list-decimal space-y-1 ps-4 text-xs text-muted">
            <li>{t.install.androidStep1}</li>
            <li>{t.install.androidStep2}</li>
            <li>{t.install.androidStep3}</li>
          </ol>
        </div>

        <div className="rounded-xl border border-bdr p-3">
          <div className="mb-2 text-sm font-semibold text-white">{t.install.iosTitle}</div>
          <ol className="list-decimal space-y-1 ps-4 text-xs text-muted">
            <li>{t.install.iosStep1}</li>
            <li>{t.install.iosStep2}</li>
            <li>{t.install.iosStep3}</li>
          </ol>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg border border-bdr px-3 py-2 text-sm text-muted hover:text-white"
        >
          {t.install.close}
        </button>
      </div>
    </div>
  );
}
