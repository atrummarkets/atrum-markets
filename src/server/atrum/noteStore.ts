import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";

/**
 * Per-owner note storage.
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

const DATA_DIR = join(process.cwd(), ".data");
const DATA_FILE = join(DATA_DIR, "notes.json");

function readAll(): StoredNote[] {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(DATA_FILE)) return [];
  return JSON.parse(readFileSync(DATA_FILE, "utf8"));
}

/** Write via a temp file + rename, so a crash mid-write cannot truncate the note DB. */
function writeAll(notes: StoredNote[]): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(notes, null, 2));
  renameSync(tmp, DATA_FILE);
}

const key = (owner: string) => owner.toLowerCase();

export function loadNotes(owner: string): StoredNote[] {
  return readAll().filter((n) => n.owner === key(owner));
}

export function addNote(note: StoredNote): void {
  const notes = readAll();
  notes.push({ ...note, owner: key(note.owner) });
  writeAll(notes);
}

export function updateNote(owner: string, id: string, patch: Partial<StoredNote>): void {
  const notes = readAll();
  const idx = notes.findIndex((n) => n.id === id && n.owner === key(owner));
  if (idx === -1) throw new Error(`no such note ${id}`);
  notes[idx] = { ...notes[idx], ...patch };
  writeAll(notes);
}

export function getNote(owner: string, id: string): StoredNote {
  const note = readAll().find((n) => n.id === id && n.owner === key(owner));
  if (!note) throw new Error(`no such note ${id}`);
  return note;
}

/** Drops a note persisted before broadcast whose transaction never landed. */
export function removeNote(owner: string, id: string): void {
  writeAll(readAll().filter((n) => !(n.id === id && n.owner === key(owner))));
}
