import { encodeAbiParameters, parseAbi } from "viem";
import { publicClient, walletClient } from "../chain";
import { loadRegistry, type RegistryMarket } from "../registry";
import { readMarket } from "../markets";
import { settleMarket } from "./admin";

/**
 * Resolve and settle oracle markets without anybody running a script.
 *
 * WHY THIS EXISTS. `PythResolver.resolve()` verifies a signed price update and calls
 * `vault.resolve()` itself, so an oracle market's outcome is determined the moment its
 * `targetTime` passes -- but somebody still had to fetch the Hermes update and submit it by
 * hand (`circuits/scripts/resolve-oracle-market.mjs`). Until they did, the market sat
 * `closed`, nobody could redeem, and the "no address decides the outcome" property was true
 * on chain and invisible in practice.
 *
 * PERMISSIONLESS ON THE CONTRACT, which is what makes this safe to automate. `resolve` takes
 * a signed Pyth update and checks it against a spec hash committed at market creation --
 * there is no privileged caller and no outcome to choose. This job can only make a market
 * reach the outcome the price feed already implies, sooner. `publishFinalTotals` is
 * permissionless too; it needs the committee key only to produce the decryption proof.
 *
 * ORDER MATTERS AND FAILURES ARE ISOLATED. Each market is resolved, then settled, and one
 * market's failure must not stop the rest -- a market whose Hermes window has genuinely
 * expired would otherwise block every other market behind it forever.
 */

const RESOLVER_ABI = parseAbi([
  "function resolve(address vault, bytes spec, bytes[] oracleData) payable",
  "function pyth() view returns (address)",
]);
const PYTH_ABI = parseAbi(["function getUpdateFee(bytes[] updateData) view returns (uint256)"]);
const VAULT_ABI = parseAbi(["function outcome() view returns (uint8)"]);

/** Matches `PythResolver.Spec`, and the encoding `create-market.mjs` hashed at creation. */
const SPEC_TUPLE = [
  {
    type: "tuple",
    components: [
      { type: "bytes32" },
      { type: "int64" },
      { type: "int32" },
      { type: "uint64" },
      { type: "uint64" },
      { type: "bool" },
    ],
  },
] as const;

interface OracleSpec {
  priceId: `0x${string}`;
  threshold: string;
  thresholdExpo: number;
  targetTime: number;
  windowSeconds: number;
  greaterThan: boolean;
}

export interface AutoResolveOutcome {
  marketId: number;
  action: "resolved" | "settled" | "resolved+settled" | "skipped" | "failed";
  detail: string;
  resolveTx?: string;
  settleTx?: string;
}

/** Oracle markets whose target time has passed and which are not yet settled. */
export async function dueOracleMarkets(): Promise<RegistryMarket[]> {
  const { markets } = await loadRegistry();
  const now = Math.floor(Date.now() / 1000);

  return markets.filter((m) => {
    if (m.resolverType !== "oracle") return false;
    const spec = m.spec as OracleSpec | undefined;
    if (!spec?.targetTime) return false;
    // Both gates matter: Pyth needs a price at/after targetTime, and the Vault refuses
    // `resolve` before resolutionStartTime.
    return now >= spec.targetTime && now >= m.resolutionStartTime;
  });
}

async function resolveOne(market: RegistryMarket): Promise<AutoResolveOutcome> {
  const spec = market.spec as OracleSpec;

  const current = await publicClient.readContract({
    address: market.vault as `0x${string}`,
    abi: VAULT_ABI,
    functionName: "outcome",
  });

  let resolveTx: string | undefined;

  if (Number(current) === 0) {
    // The FIRST update at or after targetTime -- the same one the spec's window admits, and
    // the same one the manual script picks. Taking "latest" instead would resolve against a
    // price the market never committed to.
    const hermes = await fetch(
      `https://hermes.pyth.network/v2/updates/price/${spec.targetTime}?ids[]=${spec.priceId}`,
    );
    if (!hermes.ok) {
      return {
        marketId: market.id,
        action: "failed",
        detail: `Hermes returned ${hermes.status} -- no update in range for ${spec.priceId}`,
      };
    }
    const body = await hermes.json();
    const oracleData = [`0x${body.binary.data[0]}` as `0x${string}`];

    const specEncoded = encodeAbiParameters(SPEC_TUPLE, [
      [
        spec.priceId,
        BigInt(spec.threshold),
        spec.thresholdExpo,
        BigInt(spec.targetTime),
        BigInt(spec.windowSeconds),
        spec.greaterThan,
      ],
    ]);

    const pythAddress = await publicClient.readContract({
      address: market.resolver as `0x${string}`,
      abi: RESOLVER_ABI,
      functionName: "pyth",
    });
    const fee = await publicClient.readContract({
      address: pythAddress,
      abi: PYTH_ABI,
      functionName: "getUpdateFee",
      args: [oracleData],
    });

    const hash = await walletClient.writeContract({
      address: market.resolver as `0x${string}`,
      abi: RESOLVER_ABI,
      functionName: "resolve",
      args: [market.vault as `0x${string}`, specEncoded, oracleData],
      value: fee,
      // Declared, never estimated. Monad bills the declared limit and an undershooting
      // estimate reverts -- the failure this repo has now hit on deposits, on plain
      // transfers, and would hit here.
      gas: 2_000_000n,
      // No `account` override. `walletClient` already carries a local signer; passing the
      // bare address instead makes viem treat it as a JSON-RPC account and call
      // `eth_sendTransaction`, which public RPCs do not implement -- observed as
      // "Method not found" against Ankr rather than as anything resembling a signing problem.
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      return { marketId: market.id, action: "failed", detail: "resolve reverted", resolveTx: hash };
    }
    resolveTx = hash;
  }

  // Settle is a separate concern: a market can be resolved but unsettled (the manual path
  // leaves it that way), and until totals are published nobody can redeem.
  const snapshot = await readMarket(market.id);
  if (snapshot.settled) {
    return {
      marketId: market.id,
      action: resolveTx ? "resolved" : "skipped",
      detail: resolveTx ? "resolved; already settled" : "already resolved and settled",
      resolveTx,
    };
  }

  const { txHash: settleTx } = await settleMarket(market.id);
  return {
    marketId: market.id,
    action: resolveTx ? "resolved+settled" : "settled",
    detail: `outcome ${(await readMarket(market.id)).outcome}`,
    resolveTx,
    settleTx,
  };
}

/**
 * Sweep every due oracle market.
 *
 * Sequential, not parallel: they share one operator nonce, and concurrent writes from the
 * same account race it. Sweeps are cheap and infrequent, so the wall-clock cost is irrelevant
 * next to a nonce collision that would drop transactions silently.
 */
export async function autoResolveDue(): Promise<AutoResolveOutcome[]> {
  const due = await dueOracleMarkets();
  const results: AutoResolveOutcome[] = [];

  for (const market of due) {
    try {
      results.push(await resolveOne(market));
    } catch (error) {
      results.push({
        marketId: market.id,
        action: "failed",
        detail: (error as Error).message,
      });
    }
  }

  return results;
}
