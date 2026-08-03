import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CIRCUITS_DIR } from "./chain";

/**
 * The committee decryption key.
 *
 * The secret half is genuinely needed on this server: settlement produces a Chaum-Pedersen
 * decryption share, and the odds board decrypts the accumulator for display. Both are
 * operator jobs that a browser must never do. That the operator holds the only committee key
 * at all is Phase 2's stated compromise, not something this app introduced -- Phase 3 makes
 * it a 3-of-5 threshold.
 *
 * Read from COMMITTEE_KEY_JSON (a Vercel/deployment env var holding the same JSON this file
 * used to hold) first -- a serverless deployment has no persistent, non-committed place to
 * put a secret file. Falls back to CIRCUITS_DIR/committee-key.json for local dev, where it's
 * gitignored (see .gitignore) so it never becomes a second, driftable copy of the key.
 */
interface CommitteeKey {
  pubKey: [string, string];
  secret: string;
}

let cached: CommitteeKey | null = null;

export function committeeKey(): CommitteeKey {
  if (cached) return cached;

  let raw: string;
  if (process.env.COMMITTEE_KEY_JSON) {
    raw = process.env.COMMITTEE_KEY_JSON;
  } else {
    const path = join(CIRCUITS_DIR, "committee-key.json");
    try {
      raw = readFileSync(path, "utf8");
    } catch {
      throw new Error(
        `no committee key -- set COMMITTEE_KEY_JSON, or place one at ${path} for local dev`,
      );
    }
  }

  const parsed = JSON.parse(raw) as CommitteeKey;
  if (!parsed.pubKey?.[0] || !parsed.secret) throw new Error("committee key is missing pubKey/secret");

  cached = parsed;
  return parsed;
}
