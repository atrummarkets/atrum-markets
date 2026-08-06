import { NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
import { requireOperator } from "@/server/atrum/auth";
import { upsertMarket } from "@/server/atrum/registry";
import { publicClient, POOL_ADDRESS, POOL_ABI } from "@/server/atrum/chain";

/**
 * Register a market in the registry, operator only.
 *
 * This is what makes market creation stop being a deploy. `create-market.mjs` and
 * `create-manual-market.mjs` used to rewrite `markets.json`, which meant a git push and a
 * Vercel redeploy before production knew the market existed. They now POST here and the
 * market is live on the next request.
 *
 * VIA HTTP RATHER THAN A DIRECT DATABASE WRITE, so the creation scripts -- which live in
 * atrum-core, a different repo -- never need `DATABASE_URL`. The one credential they already
 * hold is the operator key, and that is exactly what `requireOperator` checks.
 *
 * THE VAULT ADDRESS IS VERIFIED ON CHAIN, not trusted from the request. A wrong vault here
 * would point every read for this market at a contract that is not its vault -- betting window,
 * outcome and totals would all be read from the wrong place, and nothing downstream would
 * notice, because `markets.ts` trusts the registry for that one field. `marketVault[id]` is
 * write-once, so this check is both cheap and permanent.
 */
export async function POST(req: Request) {
  try {
    await requireOperator();
    const body = await req.json();

    const id = Number(body.id);
    if (!Number.isInteger(id) || id < 0) throw new Error("id must be a non-negative integer");

    const question = String(body.question ?? "").trim();
    if (!question) throw new Error("question is required");
    if (question.length > 500) throw new Error("question is too long");

    const resolverType = body.resolverType === "oracle" ? "oracle" : "manual";

    if (!isAddress(body.vault)) throw new Error("vault is not a valid address");
    if (!isAddress(body.resolver)) throw new Error("resolver is not a valid address");

    // The pool is the authority on which vault belongs to this id.
    const onChain = (await publicClient.readContract({
      address: POOL_ADDRESS,
      abi: POOL_ABI,
      functionName: "marketVault",
      args: [id],
    })) as string;

    if (onChain === "0x0000000000000000000000000000000000000000") {
      throw new Error(`market ${id} is not registered on pool ${POOL_ADDRESS} -- register it on chain first`);
    }
    if (getAddress(onChain) !== getAddress(body.vault)) {
      throw new Error(
        `vault mismatch: the pool has ${onChain} for market ${id}, the request says ${body.vault}`,
      );
    }

    await upsertMarket({
      id,
      question,
      category: String(body.category ?? "Monad"),
      resolverType,
      vault: getAddress(body.vault),
      resolver: getAddress(body.resolver),
      bettingCloseTime: Number(body.bettingCloseTime),
      resolutionStartTime: Number(body.resolutionStartTime),
      createdAt: Number(body.createdAt ?? Math.floor(Date.now() / 1000)),
      spec: body.spec,
    });

    return NextResponse.json({ ok: true, id, vault: getAddress(body.vault) });
  } catch (error) {
    const message = (error as Error).message;
    const denied = message.includes("not authorised") || message.includes("not signed in");
    return NextResponse.json({ error: message }, { status: denied ? 403 : 400 });
  }
}
