import { db } from "./db";

/**
 * Per-owner note storage, backed by Postgres.
 *
 * WHAT THIS COSTS IN TRUST, STATED PLAINLY. A note's `nullifier` and `secret` are what spend
 * it, and they live here in the clear. That is only defensible because proving ALSO runs on
 * this server -- it already sees every secret in order to build a witness -- so storing them
 * adds no trust assumption that server-side proving did not already impose. It buys real UX:
 * notes survive a cleared browser and follow the user across devices.
 *
 * It is NOT the production design. There, the browser holds its own secrets and proves
 * locally (~30MB of artifacts, cached in IndexedDB -- see HANDOFF.md's browser measurements),
 * and a server compromise reveals nothing. The UI says which of the two it is running.
 *
 * Keyed by lowercased owner address. Auth is in `auth.ts`: reading or writing a key requires a
 * signature from that address, so one user cannot enumerate another's notes.
 *
 * Previously a flat file (`.data/notes.json`) -- moved to Postgres because a serverless
 * deployment's filesystem is ephemeral and not shared across invocations, so a file-backed
 * store silently loses notes the moment more than one instance is running.
 */
export type NoteStatus = "queued" | "grafted" | "spent";

export interface StoredNote {
  id: string;
  owner: string;
  commitment: string;
  nullifier: string;
  secret: string;
  marketId: string;
  outcome: number; // 0 unbet, 1 YES, 2 NO, 3 settled
  units: string;
  status: NoteStatus;
  label: string;
  createdAt: number;
  txHash?: string;
}

interface NoteRow {
  id: string;
  owner: string;
  commitment: string;
  nullifier: string;
  secret: string;
  market_id: string;
  outcome: number;
  units: string;
  status: NoteStatus;
  label: string;
  created_at: string;
  tx_hash: string | null;
}

function fromRow(row: NoteRow): StoredNote {
  return {
    id: row.id,
    owner: row.owner,
    commitment: row.commitment,
    nullifier: row.nullifier,
    secret: row.secret,
    marketId: row.market_id,
    outcome: row.outcome,
    units: row.units,
    status: row.status,
    label: row.label,
    createdAt: Number(row.created_at),
    txHash: row.tx_hash ?? undefined,
  };
}

const key = (owner: string) => owner.toLowerCase();

export async function loadNotes(owner: string): Promise<StoredNote[]> {
  const { rows } = await db().query<NoteRow>("SELECT * FROM notes WHERE owner = $1 ORDER BY created_at ASC", [
    key(owner),
  ]);
  return rows.map(fromRow);
}

export async function addNote(note: StoredNote): Promise<void> {
  await db().query(
    `INSERT INTO notes (id, owner, commitment, nullifier, secret, market_id, outcome, units, status, label, created_at, tx_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      note.id,
      key(note.owner),
      note.commitment,
      note.nullifier,
      note.secret,
      note.marketId,
      note.outcome,
      note.units,
      note.status,
      note.label,
      note.createdAt,
      note.txHash ?? null,
    ],
  );
}

export async function updateNote(owner: string, id: string, patch: Partial<StoredNote>): Promise<void> {
  const existing = await getNote(owner, id);
  const merged: StoredNote = { ...existing, ...patch };
  const { rowCount } = await db().query(
    `UPDATE notes SET commitment=$3, nullifier=$4, secret=$5, market_id=$6, outcome=$7, units=$8,
       status=$9, label=$10, tx_hash=$11
     WHERE id=$1 AND owner=$2`,
    [
      id,
      key(owner),
      merged.commitment,
      merged.nullifier,
      merged.secret,
      merged.marketId,
      merged.outcome,
      merged.units,
      merged.status,
      merged.label,
      merged.txHash ?? null,
    ],
  );
  if (rowCount === 0) throw new Error(`no such note ${id}`);
}

export async function getNote(owner: string, id: string): Promise<StoredNote> {
  const { rows } = await db().query<NoteRow>("SELECT * FROM notes WHERE id = $1 AND owner = $2", [id, key(owner)]);
  if (rows.length === 0) throw new Error(`no such note ${id}`);
  return fromRow(rows[0]);
}

/** Drops a note persisted before broadcast whose transaction never landed. */
export async function removeNote(owner: string, id: string): Promise<void> {
  await db().query("DELETE FROM notes WHERE id = $1 AND owner = $2", [id, key(owner)]);
}
