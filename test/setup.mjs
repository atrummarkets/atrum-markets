/**
 * Test entrypoint: install the `@/` resolver, then the browser shims.
 *
 * Order matters -- the shims import `snarkjs`, and the loader must be registered before any
 * module graph that could reach an aliased import is pulled in.
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./alias-loader.mjs", pathToFileURL(`${import.meta.dirname}/`));

await import("./browser-shims.mjs");
