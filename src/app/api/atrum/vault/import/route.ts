import { NextResponse } from "next/server";
import { requireUser } from "@/server/atrum/auth";
import { loadNotes } from "@/server/atrum/noteStore";
import { refreshNotes } from "@/server/atrum/refresh";

/**
 * Hand a user the notes the SERVER-PROVING era created for them, secrets included, so their
 * browser can adopt them into a client-side vault.
 *
 * WHY THIS HAS TO EXIST. Vault notes derive their nullifier and secret from the owner's
 * signature and an index. Notes made under server-side proving have neither -- their secrets
 * were random and were stored in the `notes` table. There is no derivation that reaches them.
 * Without this endpoint, switching a deployment to client-side proving makes every existing
 * position vanish from its owner's portfolio: not lost on chain, but unspendable and invisible
 * until the flag is switched back. Right now that would include live positions in markets 40,
 * 41 and 42.
 *
 * WHY HANDING OVER SECRETS IS NOT A NEW EXPOSURE. This server already holds them in the clear
 * -- that is precisely the trust compromise client-side proving exists to end -- and it returns
 * them only to a session that has proved control of the owning address. The user learns nothing
 * about their own notes that the operator did not already know. What changes is the direction of
 * travel: after this, the browser holds them and the server's copy stops being the only one.
 *
 * The server's rows are deliberately NOT deleted. They are the only copy until the browser has
 * successfully sealed them into a vault, and a delete here would turn a failed write into
 * permanently burnt notes. Cleaning them up is a separate decision for after the migration has
 * demonstrably worked.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const owner = await requireUser();

    // Refreshed rather than read raw: this promotes anything that has grafted since the last
    // poll and sweeps abandoned deposits, so the browser adopts current states rather than
    // importing a note as `queued` that has been spendable for an hour.
    await refreshNotes(owner).catch(() => {});

    const notes = await loadNotes(owner);

    return NextResponse.json({
      notes: notes
        // A spent note cannot be spent again; importing one would show the user a phantom
        // balance whose only possible outcome is a NullifierAlreadySpent revert.
        .filter((n) => n.status !== "spent")
        .map((n) => ({
          id: n.id,
          commitment: n.commitment,
          nullifier: n.nullifier,
          secret: n.secret,
          marketId: n.marketId,
          outcome: n.outcome,
          units: n.units,
          status: n.status,
          label: n.label,
          createdAt: n.createdAt,
          txHash: n.txHash,
        })),
    });
  } catch (error) {
    const message = (error as Error).message;
    return NextResponse.json({ error: message }, { status: message.includes("not signed in") ? 401 : 400 });
  }
}
