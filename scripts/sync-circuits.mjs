#!/usr/bin/env node
/**
 * Dev-time convenience: copies exactly the circuit artifacts this app's server needs
 * (deposit / bet_encrypted / redeem_private / withdraw -- .r1cs, .zkey, _vkey.json,
 * _js/*.wasm) out of a sibling atrum-core checkout into ./circuits-build/, which IS
 * committed to this repo. Run this whenever atrum-core's circuits are rebuilt and the
 * live pool is redeployed against them -- a stale copy here fails as InvalidProof()
 * with no other diagnostic, same failure mode ATRUM_CORE_DIR used to have.
 *
 * Mirrors atrum-client/scripts/sync-assets.sh's pattern: scripted, so there's a record
 * of what produced circuits-build/, unlike a hand `cp`.
 *
 * Usage: node scripts/sync-circuits.mjs [path/to/atrum-core]
 *   defaults to ../atrum-core
 */
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..");
const atrumCoreDir = process.argv[2] ?? join(REPO_ROOT, "..", "atrum-core");
const SRC = join(atrumCoreDir, "circuits", "build");
const DST = join(REPO_ROOT, "circuits-build");

const CIRCUITS = ["deposit", "bet_encrypted", "redeem_private", "withdraw"];

if (!existsSync(SRC)) {
  console.error(`error: no circuits/build at ${SRC} -- pass the atrum-core checkout path, or run 'make circuits' there first`);
  process.exit(1);
}

mkdirSync(DST, { recursive: true });

for (const name of CIRCUITS) {
  for (const ext of ["r1cs", "zkey"]) {
    copyFileSync(join(SRC, `${name}.${ext}`), join(DST, `${name}.${ext}`));
  }
  copyFileSync(join(SRC, `${name}_vkey.json`), join(DST, `${name}_vkey.json`));
  mkdirSync(join(DST, `${name}_js`), { recursive: true });
  copyFileSync(join(SRC, `${name}_js`, `${name}.wasm`), join(DST, `${name}_js`, `${name}.wasm`));
  console.log(`synced ${name}`);
}

console.log(`\ndone -- ${DST} now matches ${SRC}. Commit circuits-build/ if this is meant to ship.`);
