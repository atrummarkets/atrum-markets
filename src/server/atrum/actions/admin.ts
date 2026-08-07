import { buildElGamal } from "../elgamal.mjs";
import { buildDLEQ } from "../dleq.mjs";
import type { Point } from "../elgamal.mjs";
import { committeeKey } from "../committee";
import {
  publicClient,
  walletClient,
  POOL_ADDRESS,
  POOL_ABI,
  VAULT_ABI,
  TOTALS_ABI,
  ACCUMULATOR_ABI,
  OUTCOME_YES,
  OUTCOME_NO,
} from "../chain";
import { registryMarket } from "../registry";


const DECRYPT_BOUND = 10_000_000n;

async function vaultFor(marketId: number): Promise<`0x${string}`> {
  const entry = await registryMarket(marketId);
  if (!entry) throw new Error(`market ${marketId} is not in the registry`);
  return entry.vault as `0x${string}`;
}

/**
 * Record the real-world outcome. `Vault.resolve` checks `msg.sender == resolver`, and on these
 * demo markets the resolver is the operator EOA -- so this is the one genuinely centralised
 * step. Production markets point `resolver` at `PythResolver`, where the outcome is a
 * comparison against a signed price and no address can decide it.
 */
export async function resolveMarket(marketId: number, side: "YES" | "NO"): Promise<{ txHash: string }> {
  const vault = await vaultFor(marketId);

  const [current, resolutionStartTime] = await Promise.all([
    publicClient.readContract({ address: vault, abi: VAULT_ABI, functionName: "outcome" }),
    publicClient.readContract({ address: vault, abi: VAULT_ABI, functionName: "resolutionStartTime" }),
  ]);
  if (Number(current) !== 0) throw new Error(`market ${marketId} is already resolved`);
  if (Math.floor(Date.now() / 1000) < Number(resolutionStartTime)) {
    throw new Error(`too early -- resolvable after ${new Date(Number(resolutionStartTime) * 1000).toISOString()}`);
  }

  const hash = await walletClient.writeContract({
    address: vault,
    abi: VAULT_ABI,
    functionName: "resolve",
    args: [side === "YES" ? 1 : 2],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`resolve reverted: ${hash}`);
  return { txHash: hash };
}

/**
 * Decrypt the accumulated totals and publish them with a Chaum-Pedersen proof.
 *
 * `publishFinalTotals` is PERMISSIONLESS on the contract, so this needs no privileged key --
 * only the committee secret, to produce the decryption share. The proof binds the share to the
 * committee key; the contract separately checks `C2 - D == [m]G`, which is what stops a valid
 * proof being published alongside a fabricated total.
 */
export async function settleMarket(
  marketId: number,
): Promise<{ txHash: string; yes: string; no: string }> {
  const vault = await vaultFor(marketId);
  const outcome = await publicClient.readContract({ address: vault, abi: VAULT_ABI, functionName: "outcome" });
  if (Number(outcome) === 0) throw new Error(`market ${marketId} has not been resolved yet`);

  const totalsAddress = (await publicClient.readContract({
    address: POOL_ADDRESS,
    abi: POOL_ABI,
    functionName: "encryptedTotals",
  })) as `0x${string}`;

  const alreadySettled = await publicClient.readContract({
    address: totalsAddress,
    abi: TOTALS_ABI,
    functionName: "settled",
    args: [marketId],
  });
  if (alreadySettled) {
    const [y, n] = await Promise.all([
      publicClient.readContract({ address: totalsAddress, abi: TOTALS_ABI, functionName: "finalYesTotal", args: [marketId] }),
      publicClient.readContract({ address: totalsAddress, abi: TOTALS_ABI, functionName: "finalNoTotal", args: [marketId] }),
    ]);
    return { txHash: "", yes: y.toString(), no: n.toString() };
  }

  const accumulatorAddress = (await publicClient.readContract({
    address: totalsAddress,
    abi: TOTALS_ABI,
    functionName: "accumulator",
  })) as `0x${string}`;

  const elgamal = await buildElGamal(committeeKey().pubKey, committeeKey().secret);
  const dleq = buildDLEQ(elgamal, committeeKey().secret);
  const { babyJub, F, asPair } = elgamal;
  const pointOf = (x: bigint, y: bigint) => [F.e(x), F.e(y)];
  /** Curve points are opaque field-element pairs to TS; `asPair` is the only way out. */
  const pt = (p: Point) => asPair(p);

  async function settleSide(sideOutcome: number) {
    const [c1x, c1y, c2x, c2y] = (await publicClient.readContract({
      address: accumulatorAddress,
      abi: ACCUMULATOR_ABI,
      functionName: "totalAffine",
      args: [marketId, sideOutcome],
    })) as [bigint, bigint, bigint, bigint];

    const c1 = pointOf(c1x, c1y);
    const c2 = pointOf(c2x, c2y);
    const claimed: bigint = elgamal.decrypt(c1, c2, DECRYPT_BOUND);
    const proof = dleq.prove(c1);

    // Verify what we are about to publish BEFORE publishing it. Trusting the BSGS result
    // blind here would defeat the point of the on-chain check.
    const D = asPair(proof.D);
    const target = babyJub.addPoint(c2, elgamal.negate(proof.D));
    const mG = claimed === 0n ? elgamal.IDENTITY : babyJub.mulPointEscalar(babyJub.Base8, claimed);
    if (!elgamal.samePoint(target, mG)) throw new Error("C2 - D != [m]G -- refusing to publish a lying total");

    return {
      total: claimed,
      decryption: {
        dx: D[0],
        dy: D[1],
        proof: { ax: pt(proof.A)[0], ay: pt(proof.A)[1], bx: pt(proof.B)[0], by: pt(proof.B)[1], z: proof.z as bigint },
      },
    };
  }

  const yes = await settleSide(OUTCOME_YES);
  const no = await settleSide(OUTCOME_NO);

  const hash = await walletClient.writeContract({
    address: totalsAddress,
    abi: TOTALS_ABI,
    functionName: "publishFinalTotals",
    args: [marketId, yes.total, no.total, yes.decryption, no.decryption],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`publishFinalTotals reverted: ${hash}`);

  return { txHash: hash, yes: yes.total.toString(), no: no.total.toString() };
}
