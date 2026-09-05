// Everything the service worker cached for this device, dropped.
//
// The worker caches navigations, so the dashboard's HTML — one user's
// areas, items and numbers — survives a sign-out and would be served to
// whoever signs in next while offline. On a shared phone that is somebody
// else's data on somebody else's screen.
//
// Two paths, because either can be the one that's available: the worker is
// asked to clear and rebuild its precache (so the offline fallback still
// works afterwards), and the page clears the caches itself in case there is
// no controlling worker yet. Both are best-effort — a failure here must
// never stop someone signing out, so nothing throws and nothing waits
// forever.
const CLEAR_TIMEOUT_MS = 1500;

export async function clearAppCache(): Promise<void> {
  try {
    const worker = navigator.serviceWorker?.controller;
    if (worker) {
      await Promise.race([
        new Promise<void>((resolve) => {
          const onMessage = (e: MessageEvent) => {
            if (e.data?.type !== "LUMEN_CACHE_CLEARED") return;
            navigator.serviceWorker.removeEventListener("message", onMessage);
            resolve();
          };
          navigator.serviceWorker.addEventListener("message", onMessage);
          worker.postMessage({ type: "LUMEN_CLEAR_CACHE" });
        }),
        new Promise<void>((resolve) => setTimeout(resolve, CLEAR_TIMEOUT_MS)),
      ]);
      return;
    }

    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // Nothing here is worth blocking a sign-out over.
  }
}
