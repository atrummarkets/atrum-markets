import { NextResponse } from "next/server";
import { grantGate } from "@/server/atrum/gate";
import { checkAndRecordAttempt } from "@/server/atrum/gateAttempts";

// Exempted from proxy.ts by design -- this IS the route that lets a browser
// in, so it can't itself require the cookie it's about to grant.

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const allowed = await checkAndRecordAttempt(ip);
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  let code: unknown;
  try {
    ({ code } = await req.json());
  } catch {
    return NextResponse.json({ error: "That did not go through." }, { status: 400 });
  }
  if (typeof code !== "string" || !code.trim()) {
    return NextResponse.json({ error: "Enter an access code." }, { status: 400 });
  }

  const landingUrl = process.env.ATRUM_LANDING_URL;
  const sharedSecret = process.env.GATE_VALIDATION_SHARED_SECRET;
  if (!landingUrl || !sharedSecret) {
    throw new Error("missing required env var ATRUM_LANDING_URL or GATE_VALIDATION_SHARED_SECRET");
  }

  let valid = false;
  try {
    const res = await fetch(`${landingUrl}/api/internal/access-code/validate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-atrum-internal-secret": sharedSecret,
      },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    valid = res.ok && data?.valid === true;
  } catch (error) {
    console.error("[gate] validate call failed:", error);
    return NextResponse.json({ error: "That did not go through. Try again." }, { status: 502 });
  }

  if (!valid) {
    return NextResponse.json({ error: "That code isn't valid." }, { status: 401 });
  }

  await grantGate();
  return NextResponse.json({ ok: true });
}
