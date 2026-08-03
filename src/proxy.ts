import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyGateToken } from "@/server/atrum/gate";

/**
 * Testnet access gate. Runs ahead of every matched request (Node.js runtime by
 * default in Next 16, which is why gate.ts's verifyGateToken can use node:crypto
 * directly instead of an edge-compatible subset).
 *
 * Deliberately does NOT cover atrum-core's sequencer, which the browser calls
 * directly for /path and /relay -- accepted gap, see the plan doc. This only
 * protects atrum-markets itself: every page and every /api/atrum/* route
 * except the two exempted below.
 */
export function proxy(request: NextRequest) {
  const token = request.cookies.get("atrum_gate")?.value;
  if (token && verifyGateToken(token)) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "access code required" }, { status: 401 });
  }

  const url = new URL("/enter", request.url);
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|enter|api/atrum/gate|favicon.ico|apple-touch-icon.png|favicon-16x16.png|favicon-32x32.png|icon-512.png).*)",
  ],
};
