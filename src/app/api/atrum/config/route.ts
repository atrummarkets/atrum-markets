import { NextResponse } from "next/server";
import { POOL_ADDRESS, COLLATERAL_ADDRESS, CHAIN_ID, PUBLIC_RPC_URL, publicClient, ERC20_ABI, POOL_ABI, operatorAddress } from "@/server/atrum/chain";
import { readPool } from "@/server/atrum/markets";
import { circuitFacts } from "@/server/atrum/circuits";
import { committeeKey } from "@/server/atrum/committee";

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
      // The PUBLIC half of the committee key. A browser proving its own bet has to encrypt the
      // stake to it, so this is not optional and not a leak -- it is the encryption target,
      // published for exactly that purpose. The secret half stays server-side, where
      // settlement and the odds board genuinely need it (see server/atrum/committee.ts).
      committeePubKey: committeeKey().pubKey,
      /**
       * Whether this deployment proves in the browser. The UI reads it to decide which trust
       * statement to make, and it is served from the server rather than inferred client-side
       * so the claim can never disagree with what the routes actually do.
       */
      clientProving: process.env.NEXT_PUBLIC_CLIENT_PROVING === "1",
      poolAbi: POOL_ABI,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
