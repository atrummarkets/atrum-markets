import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { autoResolveDue } from "@/server/atrum/actions/autoResolve";
import { currentUser } from "@/server/atrum/auth";
import { operatorAddress } from "@/server/atrum/chain";

/**
 * Sweep due oracle markets. Meant to be called on a schedule.
 *
 * Deliberately scheduler-agnostic: Vercel Cron, a GitHub Action, cron-job.org or a loop on
 * the sequencer box all work, because the endpoint is idempotent and carries its own auth.
 * Vercel's Hobby plan caps cron at once per day, which is useless for a 20-minute market, so
 * hardcoding an assumption about the caller would have been the wrong shape.
 *
 * IDEMPOTENT BY CONSTRUCTION. It re-reads each market's on-chain `outcome()` and `settled`
 * before acting, so calling it every minute costs a few RPC reads and does nothing else. That
 * matters more than it sounds: a scheduler that retries on timeout would otherwise submit a
 * second resolve for a market already resolving, and burn 2,000,000 declared gas on a revert.
 *
 * AUTH: `CRON_SECRET` via bearer token, OR an operator session so the admin page can trigger a
 * sweep by hand. Not left open -- resolving is permissionless on the contract, but this
 * endpoint spends the operator's gas, and an open endpoint that spends gas is a faucet for
 * whoever finds it.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function secretMatches(header: string | null): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected || !header) return false;
  const given = header.replace(/^Bearer\s+/i, "");
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  // Constant-time. A length-varying or short-circuiting compare on a shared secret leaks it
  // one byte at a time to anyone patient enough to measure.
  return a.length === b.length && timingSafeEqual(a, b);
}

async function authorised(req: Request): Promise<boolean> {
  if (secretMatches(req.headers.get("authorization"))) return true;
  const user = await currentUser();
  return !!user && user.toLowerCase() === operatorAddress.toLowerCase();
}

async function handle(req: Request) {
  if (!(await authorised(req))) {
    return NextResponse.json({ error: "not authorised" }, { status: 403 });
  }

  try {
    const results = await autoResolveDue();
    // `acted` counts work that succeeded. Lumping failures in with it (anything that is not
    // "skipped") reports a sweep where everything errored as a busy, productive one.
    return NextResponse.json({
      checked: results.length,
      acted: results.filter((r) => r.action !== "skipped" && r.action !== "failed").length,
      skipped: results.filter((r) => r.action === "skipped").length,
      failed: results.filter((r) => r.action === "failed").length,
      results,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/** GET so a plain scheduler can hit it with a bearer token and no body. */
export const GET = handle;
export const POST = handle;
