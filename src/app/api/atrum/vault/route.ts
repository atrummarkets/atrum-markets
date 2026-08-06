import { NextResponse } from "next/server";
import { requireUser } from "@/server/atrum/auth";
import { db } from "@/server/atrum/db";

/**
 * Storage for a note vault this server cannot read.
 *
 * The body is AES-GCM ciphertext produced in the browser under a key derived from a wallet
 * signature (`lib/atrum/client/vault.ts`). To this route it is an opaque string. It is stored
 * so that clearing a browser does not destroy the metadata needed to spend real notes, and so
 * a second device can pick them up after re-signing.
 *
 * WHAT THE OPERATOR STILL LEARNS: that an address has a vault, roughly how large it is, and
 * when it last changed. Blob length grows with note count, so "this address is active and
 * holds about N notes" leaks. Padding to a size ladder would fix it and is not done here --
 * it is a smaller leak than the one this replaces (every secret, in the clear) and pretending
 * otherwise would be the kind of overclaim the rest of this codebase avoids.
 *
 * There is no DELETE. A vault is the only copy of the metadata that makes notes spendable, and
 * an endpoint that destroys it on a single authenticated request is one bug away from burning
 * a user's funds.
 */

/** Bounded so a session cannot be used to park arbitrary data in the operator's database. */
const MAX_BLOB_BYTES = 512 * 1024;

export async function GET() {
  try {
    const owner = await requireUser();
    const { rows } = await db().query<{ blob: string }>(
      "SELECT blob FROM note_vaults WHERE owner = $1",
      [owner.toLowerCase()],
    );
    return NextResponse.json({ blob: rows[0]?.blob ?? null });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  try {
    const owner = await requireUser();
    const { blob } = await req.json();

    if (typeof blob !== "string" || blob.length === 0) {
      throw new Error("blob must be a non-empty string");
    }
    if (blob.length > MAX_BLOB_BYTES) {
      throw new Error(`vault is ${blob.length} bytes, limit is ${MAX_BLOB_BYTES}`);
    }
    // Shape only -- `iv.ciphertext`, both base64url-ish. The server cannot verify the contents
    // and should not try; this just refuses input that could not possibly decrypt, so a
    // client bug surfaces here rather than as an unreadable vault later.
    if (!/^[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/.test(blob)) {
      throw new Error("blob is not in the expected iv.ciphertext form");
    }

    await db().query(
      `INSERT INTO note_vaults (owner, blob, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (owner) DO UPDATE SET blob = EXCLUDED.blob, updated_at = now()`,
      [owner.toLowerCase(), blob],
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
