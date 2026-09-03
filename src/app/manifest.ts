import type { MetadataRoute } from "next";

// Auto-linked into every page's <head> by Next.js's app/manifest.ts file
// convention (served at /manifest.webmanifest) — lets a mobile browser
// offer "Add to Home Screen" / "Install app" and, once installed, open
// Lumen as a standalone app with no browser chrome. Colors match the
// app's own dark-theme CSS variables (globals.css) exactly, not a guess:
// background_color is --bg (the page's base background, shown as the
// splash screen while the app loads) and theme_color is --surf (the
// sidebar/header surface, shown as the OS status/toolbar color).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lumen — Territory Decision Engine",
    short_name: "Lumen",
    description: "Upload your monthly sales export, get territory-level decisions.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b1229",
    theme_color: "#121a38",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
