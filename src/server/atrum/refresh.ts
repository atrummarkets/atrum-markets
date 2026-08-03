import { loadNotes, updateNote, removeNote, type StoredNote } from "./noteStore";
import { isGrafted } from "./sequencerClient";

/**
 * A deposit whose proof we built but whose transaction the user never sent. Held briefly, then
 * swept -- otherwise an abandoned "Deposit" click leaves a QUEUED row that can never graft and
 * looks, to the user, like the sequencer is stuck.
 */
const ABANDONED_AFTER_MS = 10 * 60 * 1000;

export async function refreshNotes(owner: string): Promise<StoredNote[]> {
  const notes = await loadNotes(owner);
  const alive: StoredNote[] = [];

  await Promise.all(
    notes.map(async (n) => {
      if (n.status === "queued") {
        if (await isGrafted(BigInt(n.commitment))) {
          await updateNote(owner, n.id, { status: "grafted" });
          n.status = "grafted";
        } else if (!n.txHash && Date.now() - n.createdAt > ABANDONED_AFTER_MS) {
          await removeNote(owner, n.id);
          return;
        }
      }
      alive.push(n);
    }),
  );

  return alive.sort((a, b) => b.createdAt - a.createdAt);
}
