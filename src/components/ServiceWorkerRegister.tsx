"use client";

import { useEffect } from "react";

// Registers the runtime-caching service worker (public/sw.js) once the
// page has finished loading — deferred past load so it never competes
// with the actual page's own first-load network requests.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Best-effort: a failed registration (unsupported browser,
        // private-browsing restrictions) just means no offline caching —
        // the app still works fully online either way.
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
