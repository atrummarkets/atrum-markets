import { statSync, openSync, readSync, closeSync } from "node:fs";
import { join } from "node:path";
import { CIRCUITS_DIR } from "./chain";

/**
 * Real facts about the circuits this deployment actually proves against.
 *
 * MEASURED from the artifacts on disk, not transcribed from a doc -- a constant copied out of
 * HANDOFF.md goes stale the next time `make circuits` runs, and the UI would then state a
 * confident wrong number. Constraint counts are read from the compiled `.r1cs` header, the
 * same place snarkjs reads them; verified to match `snarkjs r1cs info` exactly for all four
 * circuits (1621 / 21252 / 14405 / 14408).
 */
export interface CircuitFacts {
  name: string;
  constraints: number;
  zkeyBytes: number;
  wasmBytes: number;
}

/**
 * Constraint count from the r1cs header.
 *
 * Layout (r1cs spec): magic "r1cs" (4) | version (4) | numSections (4), then sections of
 * {type u32, size u64}. Section type 1 is the header; inside it, after fieldSize and the
 * prime, come nWires/nPubOut/nPubIn/nPrvIn (u32 each) and nLabels (u64), then nConstraints.
 */
function readConstraints(path: string): number {
  const fd = openSync(path, "r");
  try {
    const head = Buffer.alloc(12);
    readSync(fd, head, 0, 12, 0);
    if (head.toString("utf8", 0, 4) !== "r1cs") throw new Error(`${path} is not an r1cs file`);
    const numSections = head.readUInt32LE(8);

    let offset = 12;
    for (let i = 0; i < numSections; i++) {
      const sh = Buffer.alloc(12);
      readSync(fd, sh, 0, 12, offset);
      const type = sh.readUInt32LE(0);
      const size = Number(sh.readBigUInt64LE(4));
      const body = offset + 12;

      if (type === 1) {
        const fsBuf = Buffer.alloc(4);
        readSync(fd, fsBuf, 0, 4, body);
        const fieldSize = fsBuf.readUInt32LE(0);
        const at = body + 4 + fieldSize + 16 + 8;
        const nc = Buffer.alloc(4);
        readSync(fd, nc, 0, 4, at);
        return nc.readUInt32LE(0);
      }
      offset = body + size;
    }
    throw new Error(`${path} has no header section`);
  } finally {
    closeSync(fd);
  }
}

const cache = new Map<string, CircuitFacts>();

export function circuitFacts(name: string): CircuitFacts {
  const hit = cache.get(name);
  if (hit) return hit;

  const build = CIRCUITS_DIR;
  const facts: CircuitFacts = {
    name,
    constraints: readConstraints(join(build, `${name}.r1cs`)),
    zkeyBytes: statSync(join(build, `${name}.zkey`)).size,
    wasmBytes: statSync(join(build, `${name}_js`, `${name}.wasm`)).size,
  };
  cache.set(name, facts);
  return facts;
}

export const ACTION_CIRCUIT = {
  deposit: "deposit",
  bet: "bet_encrypted",
  redeem: "redeem_private",
  withdraw: "withdraw",
} as const;
