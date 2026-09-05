// Every Lumen API route must start by establishing who is asking.
//
// The guard used to be nine hand-written lines repeated in 23 files, which
// is exactly the kind of thing that gets left off the 24th — and nothing
// would fail loudly if it were: the route would simply answer anyone. The
// middleware in src/proxy.ts is the outer gate, but a route that relies on
// it alone is one matcher edit away from being open.
//
// This reads the route files themselves rather than calling them, because
// the property worth guarding is structural: the guard is present, and it
// runs before anything else in the handler.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const API_ROOT = new URL("../src/app/api", import.meta.url).pathname;
const HANDLERS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...routeFiles(full));
    else if (entry === "route.ts") out.push(full);
  }
  return out;
}

const files = routeFiles(API_ROOT);

describe("API routes are all behind the shared auth guard", () => {
  test("there are routes to check at all", () => {
    // Guards the guard: if this file ever stops finding routes, every test
    // below would pass vacuously.
    assert.ok(files.length >= 20, `only found ${files.length} route files`);
  });

  for (const file of files) {
    const rel = file.slice(file.indexOf("src/"));
    const source = readFileSync(file, "utf8");

    test(rel, () => {
      assert.ok(
        source.includes('from "@/lib/lumen/requireUser"'),
        "does not import the shared guard",
      );

      // No route may still be hand-rolling it.
      assert.ok(
        !source.includes("supabase.auth.getUser()"),
        "calls supabase.auth.getUser() directly instead of using requireUser()",
      );

      const exported = HANDLERS.filter((h) =>
        new RegExp(`export async function ${h}\\s*\\(`).test(source),
      );
      assert.ok(exported.length > 0, "exports no request handlers");

      for (const handler of exported) {
        const start = source.search(new RegExp(`export async function ${handler}\\s*\\(`));
        const bodyStart = source.indexOf("{", source.indexOf(")", start));
        // Anchored at the very start of the body: the guard must be the
        // FIRST statement, not merely somewhere near the top. Anything run
        // before it runs for anyone who can reach the route.
        assert.match(
          source.slice(bodyStart + 1),
          /^\s*const auth = await requireUser\(\);\n\s*if \(auth\.response\) return auth\.response;/,
          `${handler} does not begin with the auth guard`,
        );
      }
    });
  }
});
