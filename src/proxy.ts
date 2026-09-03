import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // manifest.webmanifest, sw.js and offline.html must be reachable with no
    // session at all — the browser's install-prompt check fetches the
    // manifest unauthenticated, and a service worker whose registration
    // request gets redirected to /login (HTML, wrong MIME type) fails to
    // register entirely, silently breaking "Add to Home Screen".
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
