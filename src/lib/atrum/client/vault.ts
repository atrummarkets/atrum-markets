"use client";

/**
 * The note vault -- what replaces server-side secret storage.
 *
 * THE PROBLEM THIS EXISTS TO FIX. `server/atrum/noteStore.ts` holds every note's `nullifier`
 * and `secret` in the clear, and says so plainly in its own header: defensible only because
 * server-side proving already saw those secrets in order to build a witness. Once proving
 * moves into the browser (`prover.ts`), that justification is gone, and storage is the only
 * thing still handing the operator the ability to spend every user's notes.
 *
 * THE DESIGN, IN THREE PARTS.
 *
 * 1. SECRETS ARE DERIVED, NEVER STORED. A note's `nullifier`/`secret` pair is
 *    `H(seed, index, role)`, where `seed` comes from one wallet signature over a fixed
 *    domain-separated message. Nothing secret is ever written anywhere -- not to the server,
 *    not to IndexedDB. Re-signing on a new device reproduces the identical keys.
 *
 * 2. METADATA IS ENCRYPTED CLIENT-SIDE. Which notes exist, their units, outcome, and status
 *    are not derivable, so they sync through the server as a single AES-GCM blob under a key
 *    derived from the same seed. The server stores ciphertext it cannot read and hands it back
 *    to whoever proves control of the address. Cross-device access survives; the operator
 *    learns nothing but "this address has a vault of roughly this size".
 *
 * 3. INDICES ARE ALLOCATED, NEVER REUSED. Deterministic derivation means index reuse produces
 *    an identical commitment, which the tree would reject as a duplicate and which would make
 *    two notes share a nullifier. `nextIndex` lives in the blob and is persisted BEFORE the
 *    derived note is used, so a crash costs an unused index rather than a collision.
 *
 * WHAT THIS STILL DOES NOT FIX, STATED PLAINLY. The seed is only as private as the browser
 * holding it; this trades a compromised-server problem for a compromised-device one, which is
 * the trade every non-custodial wallet already makes.
 */
import { FIELD_SIZE } from "./crypto";

/**
 * Domain-separated and version-tagged. The wallet shows this text verbatim, so it has to
 * explain the stakes to someone who will not read the code: this signature IS the key.
 * Changing a single byte derives a different vault, which is why it is a frozen constant and
 * not a template -- and why the version is in it, so a future change is deliberate.
 */
export const VAULT_MESSAGE =
  "Atrum note vault v1\n\n" +
  "Signing this derives the keys that control your shielded notes. " +
  "It is not a transaction and costs nothing.\n\n" +
  "Only ever sign this on a site you trust. Anyone who obtains this signature can spend your notes.";

export type NoteStatus = "queued" | "grafted" | "spent";

/**
 * The non-secret half of a note. Secrets are re-derived from `index` on demand -- except for
 * notes adopted from the server-proving era, which carry theirs explicitly.
 */
export interface VaultNote {
  id: string;
  /** Derivation slot. Ignored when `imported` is present. */
  index: number;
  commitment: string;
  marketId: string;
  outcome: number; // 0 unbet, 1 YES, 2 NO, 3 settled
  units: string;
  status: NoteStatus;
  label: string;
  createdAt: number;
  txHash?: string;
  /**
   * Secrets for a note this vault did NOT derive.
   *
   * Notes created under server-side proving had random secrets held in the `notes` table, and
   * no derivation reaches them. Adopting them is the only alternative to every existing
   * position vanishing the moment a deployment switches to client-side proving. Decimal
   * strings, because the blob is JSON and BigInt does not survive it.
   *
   * Present only on migrated notes; everything created since derives from `index` as usual.
   */
  imported?: { nullifier: string; secret: string };
}

interface VaultBlob {
  version: 1;
  nextIndex: number;
  notes: VaultNote[];
  /**
   * Whether the one-time adoption of server-proving notes has run.
   *
   * A flag rather than a per-poll comparison, because the server's `notes` rows are not updated
   * when this vault spends one. Re-importing would keep resurrecting notes the vault has
   * already spent, and the user would see phantom balances that revert on use.
   */
  importedLegacy?: boolean;
}

const EMPTY: VaultBlob = { version: 1, nextIndex: 0, notes: [], importedLegacy: false };

// ---------------------------------------------------------------------------
// Key derivation
// ---------------------------------------------------------------------------

const enc = new TextEncoder();

/**
 * `Uint8Array<ArrayBuffer>`, not the default `Uint8Array<ArrayBufferLike>`.
 *
 * WebCrypto's `BufferSource` excludes SharedArrayBuffer-backed views, and TypeScript 5.7+
 * models that difference. Every buffer here is freshly allocated and never shared, so pinning
 * the type is accurate rather than a cast that hides something.
 */
type Bytes = Uint8Array<ArrayBuffer>;

function alloc(n: number): Bytes {
  return new Uint8Array(new ArrayBuffer(n));
}

async function sha256(...parts: Uint8Array[]): Promise<Bytes> {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const joined = alloc(total);
  let at = 0;
  for (const p of parts) {
    joined.set(p, at);
    at += p.length;
  }
  return new Uint8Array(await crypto.subtle.digest("SHA-256", joined)) as Bytes;
}

function hexToBytes(hex: string): Bytes {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = alloc(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  return n;
}

/**
 * The vault seed: SHA-256 of the raw signature bytes.
 *
 * Hashed rather than used raw because an ECDSA signature is structured (r‖s‖v) and its low
 * bytes are not uniform; every downstream key here assumes a uniform 32 bytes.
 */
export async function deriveSeed(signature: string): Promise<Bytes> {
  return sha256(enc.encode("atrum/vault/seed/v1"), hexToBytes(signature));
}

/**
 * A note's field elements for slot `index`.
 *
 * Reduced mod `FIELD_SIZE` the same way the server's `randomField()` does. The modulo bias is
 * negligible at 256 bits against this prime and is the identical bias the server-side path
 * already had, so this changes nothing about note unpredictability.
 */
export async function deriveNoteSecrets(
  seed: Bytes,
  index: number,
): Promise<{ nullifier: bigint; secret: bigint }> {
  const label = enc.encode(`atrum/vault/note/v1/${index}/`);
  const [n, s] = await Promise.all([
    sha256(seed, label, enc.encode("nullifier")),
    sha256(seed, label, enc.encode("secret")),
  ]);
  return {
    nullifier: bytesToBigInt(n) % FIELD_SIZE,
    secret: bytesToBigInt(s) % FIELD_SIZE,
  };
}

async function blobKey(seed: Bytes): Promise<CryptoKey> {
  const raw = await sha256(seed, enc.encode("atrum/vault/blob/v1"));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

// ---------------------------------------------------------------------------
// Blob encryption
// ---------------------------------------------------------------------------

function toB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(b64: string): Bytes {
  const s = atob(b64);
  const out = alloc(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export async function encryptBlob(seed: Bytes, blob: VaultBlob): Promise<string> {
  const key = await blobKey(seed);
  // Fresh 96-bit nonce per write. GCM is catastrophically broken by nonce reuse under the
  // same key, and this key is long-lived, so the nonce must never be derived or counted.
  const iv = crypto.getRandomValues(alloc(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(blob))),
  );
  return `${toB64(iv)}.${toB64(ct)}`;
}

export async function decryptBlob(seed: Bytes, payload: string): Promise<VaultBlob> {
  const [ivB64, ctB64] = payload.split(".");
  if (!ivB64 || !ctB64) throw new Error("vault blob is malformed");
  const key = await blobKey(seed);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(ivB64) },
    key,
    fromB64(ctB64),
  );
  const parsed = JSON.parse(new TextDecoder().decode(plain)) as VaultBlob;
  if (parsed.version !== 1) throw new Error(`unsupported vault version ${parsed.version}`);
  return parsed;
}

// ---------------------------------------------------------------------------
// The vault itself
// ---------------------------------------------------------------------------

/**
 * An unlocked vault. Held in memory for the session; the seed never leaves this object, and
 * this object is never serialised.
 */
export class Vault {
  // Explicit fields rather than TypeScript parameter properties: parameter properties are
  // the one class feature Node's strip-only type removal cannot handle, and the regression
  // suite imports this module directly under `--experimental-strip-types` so that it tests
  // the shipped code rather than a copy of it.
  private readonly seed: Bytes;
  private blob: VaultBlob;

  private constructor(seed: Bytes, blob: VaultBlob) {
    this.seed = seed;
    this.blob = blob;
  }

  /**
   * Unlock with a signature, pulling and decrypting whatever the server holds.
   *
   * A blob that will not decrypt is NOT treated as empty. Overwriting it would destroy the
   * only copy of the metadata needed to spend real notes, and the likeliest cause is a
   * different wallet or a changed message -- both recoverable, unlike a clobbered vault.
   */
  static async unlock(signature: string, stored: string | null): Promise<Vault> {
    const seed = await deriveSeed(signature);
    if (!stored) return new Vault(seed, structuredClone(EMPTY));
    try {
      return new Vault(seed, await decryptBlob(seed, stored));
    } catch {
      throw new Error(
        "your vault could not be decrypted -- this signature does not match the one that created it. " +
          "Check you are on the same wallet address; nothing has been overwritten.",
      );
    }
  }

  get notes(): VaultNote[] {
    return this.blob.notes;
  }

  note(id: string): VaultNote {
    const found = this.blob.notes.find((n) => n.id === id);
    if (!found) throw new Error(`no such note ${id}`);
    return found;
  }

  /** Secrets for a note already in the vault: adopted ones carry theirs, the rest derive. */
  secretsFor(note: VaultNote): Promise<{ nullifier: bigint; secret: bigint }> {
    if (note.imported) {
      return Promise.resolve({
        nullifier: BigInt(note.imported.nullifier),
        secret: BigInt(note.imported.secret),
      });
    }
    return deriveNoteSecrets(this.seed, note.index);
  }

  get hasImportedLegacy(): boolean {
    return this.blob.importedLegacy === true;
  }

  /**
   * Adopt notes from the server-proving era. Runs once.
   *
   * `index: -1` marks them as non-derived -- nothing allocates that slot, and `secretsFor`
   * never consults it. Existing ids are left alone so a re-run cannot overwrite a note this
   * vault has since spent.
   */
  adoptLegacy(notes: Omit<VaultNote, "index">[]): number {
    const existing = new Set(this.blob.notes.map((n) => n.id));
    const fresh = notes.filter((n) => !existing.has(n.id)).map((n) => ({ ...n, index: -1 }));
    this.blob.notes = [...this.blob.notes, ...fresh];
    this.blob.importedLegacy = true;
    return fresh.length;
  }

  /**
   * Reserve the next derivation slot and hand back its secrets.
   *
   * The counter advances here, before the caller has built anything. Advancing it afterwards
   * would let a failure between derive and commit hand the same index to the next action --
   * two notes with one nullifier, the exact failure this ordering exists to prevent. An index
   * burned by a failed action is free; a reused one is not.
   */
  async allocate(): Promise<{ index: number; nullifier: bigint; secret: bigint }> {
    const index = this.blob.nextIndex;
    this.blob.nextIndex = index + 1;
    const { nullifier, secret } = await deriveNoteSecrets(this.seed, index);
    return { index, nullifier, secret };
  }

  add(note: VaultNote): void {
    this.blob.notes = [...this.blob.notes.filter((n) => n.id !== note.id), note];
  }

  update(id: string, patch: Partial<VaultNote>): void {
    this.blob.notes = this.blob.notes.map((n) => (n.id === id ? { ...n, ...patch } : n));
  }

  remove(id: string): void {
    this.blob.notes = this.blob.notes.filter((n) => n.id !== id);
  }

  /** Ciphertext to hand to the server. */
  seal(): Promise<string> {
    return encryptBlob(this.seed, this.blob);
  }
}
