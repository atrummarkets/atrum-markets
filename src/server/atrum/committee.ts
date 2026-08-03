import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ATRUM_CORE_DIR } from "./chain";

/**
 * The committee decryption key, READ FROM atrum-core AT RUNTIME.
 *
 * Never copied into this repo. `atrum-core` deliberately gitignores
 * `circuits/build/committee-key.json`, and a copy here would both commit a key that can
 * decrypt every bet on the pool and give it a second home to drift from -- the same class of
 * bug that has already cost this project three redeployments (see the deployments README).
 *
 * The secret half is genuinely needed on this server: settlement produces a Chaum-Pedersen
 * decryption share, and the odds board decrypts the accumulator for display. Both are
 * operator jobs that a browser must never do. That the operator holds the only committee key
 * at all is Phase 2's stated compromise, not something this app introduced -- Phase 3 makes
 * it a 3-of-5 threshold.
 */
interface CommitteeKey {
  pubKey: [string, string];
  secret: string;
}

let cached: CommitteeKey | null = null;

export function committeeKey(): CommitteeKey {
  if (cached) return cached;

  const path = join(ATRUM_CORE_DIR, "circuits", "build", "committee-key.json");
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    throw new Error(
      `no committee key at ${path} -- run \`make keygen\` in atrum-core, and check ATRUM_CORE_DIR`,
    );
  }

  const parsed = JSON.parse(raw) as CommitteeKey;
  if (!parsed.pubKey?.[0] || !parsed.secret) throw new Error(`${path} is missing pubKey/secret`);

  cached = parsed;
  return parsed;
}
