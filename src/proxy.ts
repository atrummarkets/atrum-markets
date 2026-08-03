import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Testnet access gate -- DISABLED. The site is public.
 *
 * The gate (access-code check via atrum-landing, GATE_SECRET-signed cookie) is still in
 * src/server/atrum/gate.ts and src/app/api/atrum/gate/route.ts if it's ever wanted back --
 * this just stops proxy.ts from enforcing it. Re-enable by restoring the matcher below and
 * the check against verifyGateToken.
 */
export function proxy(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
