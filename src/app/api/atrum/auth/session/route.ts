import { NextResponse } from "next/server";
import { currentUser } from "@/server/atrum/auth";

export async function GET() {
  return NextResponse.json({ address: await currentUser() });
}
