import { NextResponse } from "next/server";
import { signIn } from "@/server/atrum/auth";

export async function POST(req: Request) {
  try {
    const { address, nonce, signature } = await req.json();
    const user = await signIn(String(address), String(nonce), signature);
    return NextResponse.json({ address: user });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }
}
