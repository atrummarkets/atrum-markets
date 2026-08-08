import { NextResponse } from "next/server";
import { requireUser } from "@/server/atrum/auth";
import { relay, type RelayAction } from "@/server/atrum/relay";

/**
 * Forward a proof the BROWSER built to the sequencer's relayer.
 *
 * This is what replaces `/api/atrum/{bet,redeem,withdraw}` once proving is client-side. The
 * server's whole remaining job for a shielded action is to be a funded transaction sender:
 * it receives a finished Groth16 proof and public arguments, and knows nothing else. No note
 * secret is in this request, which is the entire point.
 *
 * WHY IT STILL REQUIRES A SESSION. The contract gates these actions on the proof, never on
 * `msg.sender`, so an unauthenticated relay would be sound in the cryptographic sense -- and
 * would also be a free, open, gas-spending endpoint pointed at the operator's wallet. Relaying
 * costs ~0.5 MON per action (`ACTION_GAS_LIMIT` bills the full declared 2,500,000 whether the
 * transaction uses it or not), so the session is a spend control, not a security control, and
 * is documented as such.
 *
 * WHAT THE SERVER LEARNS ANYWAY, STATED PLAINLY. A session ties this request to an address,
 * and the request carries the nullifier hash being spent. Client-side proving stops the
 * operator SPENDING a user's notes; it does not by itself stop the operator CORRELATING them.
 * Closing that needs the relay to be unauthenticated-but-paid (or fronted by something the
 * operator does not run), which is a Phase 3 concern and is not solved here.
 */
const ACTIONS: readonly RelayAction[] = ["betEncrypted", "redeemPrivate", "withdraw"];

/** Rejects anything that is not a decimal field element, before it reaches the sequencer. */
function field(value: unknown, what: string): string {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new Error(`${what} must be a decimal string`);
  }
  return value;
}

function fieldArray(value: unknown, what: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${what} must be an array`);
  return value.map((v, i) => field(v, `${what}[${i}]`));
}

export async function POST(req: Request) {
  try {
    await requireUser();
    const body = await req.json();

    const action = body.action as RelayAction;
    if (!ACTIONS.includes(action)) {
      throw new Error(`action must be one of ${ACTIONS.join(", ")}`);
    }

    // Shape-checked rather than trusted. These go straight into a transaction the operator
    // pays for; a malformed proof would burn the full gas limit on a revert.
    const pA = fieldArray(body.pA, "pA");
    if (pA.length !== 2) throw new Error("pA must have 2 elements");

    if (!Array.isArray(body.pB) || body.pB.length !== 2) throw new Error("pB must be 2x2");
    const pB = body.pB.map((row: unknown, i: number) => {
      const r = fieldArray(row, `pB[${i}]`);
      if (r.length !== 2) throw new Error(`pB[${i}] must have 2 elements`);
      return r;
    });

    const pC = fieldArray(body.pC, "pC");
    if (pC.length !== 2) throw new Error("pC must have 2 elements");

    if (!Array.isArray(body.args)) throw new Error("args must be an array");
    const args = body.args.map((a: unknown, i: number) =>
      Array.isArray(a) ? fieldArray(a, `args[${i}]`).map(BigInt) : BigInt(field(a, `args[${i}]`)),
    );

    const result = await relay(
      action,
      {
        pA: [BigInt(pA[0]), BigInt(pA[1])],
        pB: [
          [BigInt(pB[0][0]), BigInt(pB[0][1])],
          [BigInt(pB[1][0]), BigInt(pB[1][1])],
        ],
        pC: [BigInt(pC[0]), BigInt(pC[1])],
        publicSignals: [],
      },
      args,
    );

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
