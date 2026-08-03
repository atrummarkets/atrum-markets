import { NextResponse } from "next/server";
import { newNonce, nonceMessage } from "@/server/atrum/auth";

export async function GET() {
  const nonce = await newNonce();
  return NextResponse.json({ nonce, message: nonceMessage(nonce) });
}
