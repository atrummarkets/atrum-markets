/**
 * Resolve `@/...` the way Next does, so the real client modules can be imported under plain
 * Node for testing.
 *
 * Without this the tests would have to re-implement `vault.ts`'s key derivation and
 * `actions.ts`'s witness construction, which would defeat the point -- a test that restates
 * the code it is checking passes forever, including when the real code is wrong. Node 24
 * strips the TypeScript itself; this only fixes module resolution.
 */
import { pathToFileURL, fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { existsSync } from "node:fs";

const SRC = join(import.meta.dirname, "..", "src");

/** `./crypto` -> `./crypto.ts`. Bundlers infer extensions; Node requires them. */
const EXTENSIONS = [".ts", ".tsx", ".mjs", ".js"];

function withExtension(path) {
  if (existsSync(path)) return path;
  for (const ext of EXTENSIONS) {
    if (existsSync(path + ext)) return path + ext;
  }
  return path;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const path = withExtension(join(SRC, specifier.slice(2)));
    return nextResolve(pathToFileURL(path).href, context);
  }

  if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    const path = withExtension(join(dirname(fileURLToPath(context.parentURL)), specifier));
    if (existsSync(path)) return nextResolve(pathToFileURL(path).href, context);
  }

  return nextResolve(specifier, context);
}
