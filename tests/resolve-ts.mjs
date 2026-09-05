// Lets `node --test` import the app's own modules unchanged.
//
// Source files import the way a bundler expects — "./engine" with no
// extension, and "@/lib/..." through the tsconfig path alias. Node's ESM
// loader does neither, so without this, only leaf modules with no relative
// imports of their own could be tested. Rather than bend the app's imports
// to suit the test runner, teach the test runner the two rules the bundler
// already follows.
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as resolvePath } from "node:path";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));
const EXTENSIONS = [".ts", ".tsx", ".js", ".mjs"];

function firstExisting(base) {
  for (const ext of EXTENSIONS) {
    if (existsSync(base + ext)) return base + ext;
  }
  for (const ext of EXTENSIONS) {
    const indexFile = resolvePath(base, "index" + ext);
    if (existsSync(indexFile)) return indexFile;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    // "@/lib/lumen/engine" -> <repo>/src/lib/lumen/engine
    if (specifier.startsWith("@/")) {
      const found = firstExisting(resolvePath(SRC, specifier.slice(2)));
      if (found) return { url: pathToFileURL(found).href, shortCircuit: true };
    }

    // "./engine" -> ./engine.ts, when the extension was left off
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      const fromDir = dirname(fileURLToPath(context.parentURL));
      const found = firstExisting(resolvePath(fromDir, specifier));
      if (found) return { url: pathToFileURL(found).href, shortCircuit: true };
    }

    return nextResolve(specifier, context);
  },
});
