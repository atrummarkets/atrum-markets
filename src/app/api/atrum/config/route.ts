import { NextResponse } from "next/server";
import { POOL_ADDRESS, COLLATERAL_ADDRESS, CHAIN_ID, PUBLIC_RPC_URL, publicClient, ERC20_ABI, POOL_ABI, operatorAddress } from "@/server/atrum/chain";
import { readPool } from "@/server/atrum/markets";
import { circuitFacts } from "@/server/atrum/circuits";

/** Everything the browser needs to talk to this deployment. All read from chain or disk. */
export async function GET() {
  try {
    const [pool, symbol, decimals] = await Promise.all([
      readPool(),
      publicClient.readContract({ address: COLLATERAL_ADDRESS, abi: [{ name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] }] as const, functionName: "symbol" }),
      publicClient.readContract({ address: COLLATERAL_ADDRESS, abi: ERC20_ABI, functionName: "decimals" }),
    ]);

    return NextResponse.json({
      chainId: CHAIN_ID,
      rpcUrl: PUBLIC_RPC_URL,
      pool: POOL_ADDRESS,
      collateral: COLLATERAL_ADDRESS,
      token: { symbol, decimals: Number(decimals) },
      poolState: pool,
      circuits: {
        deposit: circuitFacts("deposit"),
        bet: circuitFacts("bet_encrypted"),
        redeem: circuitFacts("redeem_private"),
        withdraw: circuitFacts("withdraw"),
      },
      // Public already -- it is the `from` on every resolve and settle transaction, and the
      // `resolver` stored in each demo market's Vault. Served so the UI can hide operator
      // controls from everyone else; the routes enforce it regardless.
      operator: operatorAddress,
      poolAbi: POOL_ABI,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
