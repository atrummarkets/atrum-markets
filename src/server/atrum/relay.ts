import { SEQUENCER_URL } from "./chain";
import type { ProofResult } from "./prove";

/**
 * Submit a proof-gated action through the sequencer's relayer.
 *
 * This is the whole point of relaying, and it is not a convenience: `betEncrypted`,
 * `redeemPrivate` and `withdraw` are gated on the PROOF, never on `msg.sender`, so a relayer
 * can submit them and the user's address never appears on chain beside their action. Without
 * it, a Merkle proof carefully hides which note was spent and the ElGamal ciphertext hides how
 * much -- and then `tx.from` names the actor anyway.
 *
 * `deposit` is deliberately NOT relayable: it pulls collateral with
 * `transferFrom(msg.sender)`, so relaying it would just move the payment link one hop.
 *
 * What it does not fix, per `sequencer/src/relay.ts`: the relayer knows it was you. Trust is
 * relocated, not removed.
 */
export interface RelayResult {
  hash: `0x${string}`;
  blockNumber: number;
  gasUsed: string;
  relayer: string;
}

export type RelayAction = "betEncrypted" | "redeemPrivate" | "withdraw";

export async function relay(
  action: RelayAction,
  proof: ProofResult,
  args: readonly (bigint | readonly bigint[])[],
): Promise<RelayResult> {
  const res = await fetch(`${SEQUENCER_URL}/relay`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action,
      pA: proof.pA.map(String),
      pB: proof.pB.map((row) => row.map(String)),
      pC: proof.pC.map(String),
      args: args.map((a) => (Array.isArray(a) ? a.map(String) : String(a))),
    }),
  });

  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `relay failed (${res.status})`);
  return body as RelayResult;
}
