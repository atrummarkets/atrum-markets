/**
 * Copy the proving artifacts the BROWSER needs out of `circuits-build/` and into
 * `public/circuits/`, so they are served as ordinary static files.
 *
 * Why static files and not an API route: a Vercel serverless function may return at most
 * ~4.5MB, and `bet_encrypted.zkey` alone is 10MB. Routing artifacts through a handler works
 * locally and then fails only in production, on the one circuit users need most. Static
 * assets have no such cap and are CDN-cached for free.
 *
 * Only `.wasm` (witness generation) and `.zkey` (proving key) ship. `.r1cs` stays server-side
 * -- it is read at request time purely to report real constraint counts (`server/atrum/
 * circuits.ts`), and it is the largest file in the tree with no client use. Verification keys
 * stay server-side too: the browser proving its own proof would be checking its own work.
 *
 * Run from `prebuild`, so a deploy cannot ship a stale or missing artifact set. `public/
 * circuits/` is gitignored -- these are build outputs of `circuits-build/`, and a second
 * committed copy is a second thing to drift, which this repo has been bitten by three times
 * (see HANDOFF.md's stale-artefact bugs).
 */
import { copyFileSync, mkdirSync, existsSync, statSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const SRC = join(ROOT, "circuits-build");
const DEST = join(ROOT, "public", "circuits");

/** Circuit ids exactly as `circuits-build/` names them. */
const CIRCUITS = ["deposit", "bet_encrypted", "redeem_private", "withdraw"];

if (!existsSync(SRC)) {
  console.error(`no circuits-build/ at ${SRC} -- nothing to stage`);
  process.exit(1);
}

mkdirSync(DEST, { recursive: true });

const manifest = {};
let total = 0;

for (const circuit of CIRCUITS) {
  const wasmFrom = join(SRC, `${circuit}_js`, `${circuit}.wasm`);
  const zkeyFrom = join(SRC, `${circuit}.zkey`);

  for (const [kind, from] of [
    ["wasm", wasmFrom],
    ["zkey", zkeyFrom],
  ]) {
    if (!existsSync(from)) {
      console.error(`missing ${kind} for ${circuit}: ${from}`);
      process.exit(1);
    }
    const to = join(DEST, `${circuit}.${kind}`);
    copyFileSync(from, to);
    const bytes = statSync(to).size;
    total += bytes;
    manifest[circuit] ??= {};
    manifest[circuit][kind] = bytes;
  }
}

// The client reads this to show real download sizes before it starts fetching 30MB, and to
// detect a partially-cached artifact set. Sizes are measured here rather than hardcoded
// anywhere, for the same reason constraint counts are parsed rather than transcribed.
writeFileSync(join(DEST, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

const mb = (n) => `${(n / 1_048_576).toFixed(1)}MB`;
for (const circuit of CIRCUITS) {
  console.log(`  ${circuit.padEnd(15)} wasm ${mb(manifest[circuit].wasm).padStart(7)}  zkey ${mb(manifest[circuit].zkey).padStart(7)}`);
}
console.log(`staged ${CIRCUITS.length} circuits into public/circuits (${mb(total)} total)`);
