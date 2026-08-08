"use client";

/**
 * Vault lifecycle: unlock, sync, refresh.
 *
 * UNLOCKING IS A SECOND SIGNATURE, and deliberately not folded into sign-in. Sign-in proves
 * "I control this address" to the server; this signature derives spending keys and must never
 * be sent anywhere. Reusing one signature for both would mean the value that unlocks every
 * note travels to the server on every login -- which is the exact property this whole change
 * exists to remove. Two prompts, two purposes, one of which the server never sees.
 *
 * It is also LAZY. A visitor browsing markets is not asked to sign anything; the prompt comes
 * the first time an action actually needs a note. Asking up front for a signature whose text
 * warns "anyone who obtains this can spend your notes" is a good way to lose a first-time user
 * at the door.
 *
 * THE VAULT IS KEYED BY ADDRESS, and a key mismatch reads as locked. That is deliberately a
 * derivation rather than a reset-on-change: an effect that cleared the vault would run after
 * the commit, so for one frame a newly-switched account would be shown the previous account's
 * decrypted notes. Deriving means that frame cannot exist, and it keeps the reset off both
 * the render path's state and its refs.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { Vault, VAULT_MESSAGE, type VaultNote } from "./vault";
import { graftedSet } from "./tree";
import type { ActionContext } from "./actions";

/** A deposit proved but never broadcast. Swept, matching the server path's behaviour. */
const ABANDONED_AFTER_MS = 10 * 60 * 1000;

export type SignMessage = (message: string) => Promise<string>;

async function loadBlob(): Promise<string | null> {
  const res = await fetch("/api/atrum/vault");
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "could not load your vault");
  return body.blob ?? null;
}

async function saveBlob(blob: string): Promise<void> {
  const res = await fetch("/api/atrum/vault", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ blob }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "could not save your vault");
}

/** The unlocked vault together with the address it belongs to. */
/**
 * Notes the server-proving era created for this address, secrets included.
 *
 * Best effort: a vault that unlocks without them still works for anything created since, and
 * failing the unlock outright would lock a user out over a transient network error. Returns
 * null on failure so the caller can tell "nothing to adopt" from "could not ask" -- the
 * difference matters, because the second must not set the imported-once flag.
 */
async function fetchLegacyNotes(): Promise<Omit<VaultNote, "index">[] | null> {
  try {
    const res = await fetch("/api/atrum/vault/import");
    if (!res.ok) return null;
    const body = (await res.json()) as {
      notes: (Omit<VaultNote, "index" | "imported"> & { nullifier: string; secret: string })[];
    };
    return body.notes.map(({ nullifier, secret, ...rest }) => ({
      ...rest,
      imported: { nullifier, secret },
    }));
  } catch {
    return null;
  }
}

interface Held {
  address: string | null;
  vault: Vault;
}

export interface UseVault {
  notes: VaultNote[];
  unlocked: boolean;
  unlocking: boolean;
  /** Prompts for the vault signature if not already unlocked. Idempotent and de-duplicated. */
  unlock: () => Promise<Vault>;
  /** An unlocked context for `actions.ts`, unlocking first if needed. */
  context: () => Promise<ActionContext>;
  refresh: () => Promise<void>;
  lock: () => void;
}

export function useVault(
  signMessage: SignMessage | null,
  committeePubKey: readonly [string, string] | null,
  sessionAddress: string | null,
): UseVault {
  const [held, setHeld] = useState<Held | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  // Bumped whenever the (mutable) vault's contents change, so `notes` recomputes. The vault is
  // mutated in place by `actions.ts`; without a version React would never see the change.
  const [version, setVersion] = useState(0);
  // Concurrent callers must share one prompt. Two actions racing would otherwise pop two
  // wallet dialogs for the same signature and derive the vault twice.
  const inflight = useRef<Promise<Vault> | null>(null);

  // A vault held for a different address is not this user's vault. No reset needed.
  const active = held && held.address === sessionAddress ? held.vault : null;

  const notes = useMemo(
    () => (active ? [...active.notes].sort((a, b) => b.createdAt - a.createdAt) : []),
    // `version` is the whole point: `active` is referentially stable across mutations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, version],
  );

  const publish = useCallback(() => setVersion((v) => v + 1), []);

  const lock = useCallback(() => {
    inflight.current = null;
    setHeld(null);
  }, []);

  const unlock = useCallback(async (): Promise<Vault> => {
    if (held && held.address === sessionAddress) return held.vault;
    if (inflight.current) return inflight.current;
    if (!signMessage) throw new Error("connect your wallet first");

    const forAddress = sessionAddress;
    const run = (async () => {
      setUnlocking(true);
      try {
        // The stored blob is fetched BEFORE prompting, so a network failure does not waste the
        // user's signature -- and, more importantly, so `Vault.unlock` can never mistake an
        // unreachable server for an empty vault and start a fresh one over the top of it.
        const stored = await loadBlob();
        const signature = await signMessage(VAULT_MESSAGE);

        // A vault is only as recoverable as the wallet's signature is REPRODUCIBLE. The seed is
        // SHA-256 of these exact bytes, so a wallet that signs the same message differently
        // twice derives a different vault every session and locks its owner out of their own
        // notes -- on this browser, not just on a new device.
        //
        // Ordinary EOAs are safe: RFC 6979 makes ECDSA deterministic. Smart-contract accounts
        // (Safe, ERC-4337, Coinbase Smart Wallet) sign via ERC-1271 and promise nothing of the
        // sort, and the connector will happily connect one.
        //
        // Checked ONLY when creating a vault, so it costs one extra prompt once and never
        // again. Discovering this at creation is a supported-wallet message; discovering it
        // later is a permanent lockout with no self-service recovery.
        if (stored === null) {
          const again = await signMessage(VAULT_MESSAGE);
          if (again !== signature) {
            throw new Error(
              "This wallet signs the same message differently each time, so it cannot hold a " +
                "note vault -- your notes would be unrecoverable on the next visit. Smart-contract " +
                "wallets usually behave this way. Connect a standard wallet (MetaMask, Rabby, or a " +
                "hardware wallet) instead.",
            );
          }
        }

        const vault = await Vault.unlock(signature, stored);

        // Adopt anything from the server-proving era, once. Without this, switching a
        // deployment to client-side proving makes every existing position vanish from its
        // owner's portfolio -- unspendable and invisible until the flag is switched back.
        if (!vault.hasImportedLegacy) {
          const legacy = await fetchLegacyNotes();
          if (legacy) {
            vault.adoptLegacy(legacy);
            await saveBlob(await vault.seal());
          }
        }
        // Stamped with the address it was unlocked for. If the user switched wallets while
        // this was in flight, the stamp will not match and it reads as locked rather than
        // silently attaching one account's notes to another.
        setHeld({ address: forAddress, vault });
        return vault;
      } finally {
        setUnlocking(false);
        inflight.current = null;
      }
    })();

    inflight.current = run;
    return run;
  }, [held, sessionAddress, signMessage]);

  const save = useCallback(async () => {
    const vault = held && held.address === sessionAddress ? held.vault : null;
    if (!vault) throw new Error("vault is locked");
    await saveBlob(await vault.seal());
    publish();
  }, [held, sessionAddress, publish]);

  const context = useCallback(async (): Promise<ActionContext> => {
    if (!committeePubKey) throw new Error("config not loaded");
    const vault = await unlock();
    return { vault, save, committeePubKey };
  }, [unlock, save, committeePubKey]);

  /**
   * Promote queued notes that have grafted, and sweep abandoned deposits.
   *
   * Mirrors `server/atrum/refresh.ts`. Only writes back when something actually changed --
   * an unconditional save on every 5-second poll would rewrite the blob (and burn a fresh
   * GCM nonce) forever for no reason.
   *
   * Membership is checked against the locally mirrored tree, so this poll no longer posts the
   * user's queued commitments to the server every five seconds -- which was the same
   * correlation leak `/path` had, just in bulk and on a timer.
   */
  const refresh = useCallback(async () => {
    if (!active) return;

    const queued = active.notes.filter((n) => n.status === "queued");
    if (queued.length === 0) return;

    const grafted = await graftedSet(queued.map((n) => n.commitment));

    let changed = false;
    for (const note of queued) {
      if (grafted[note.commitment]) {
        active.update(note.id, { status: "grafted" });
        changed = true;
      } else if (!note.txHash && Date.now() - note.createdAt > ABANDONED_AFTER_MS) {
        active.remove(note.id);
        changed = true;
      }
    }

    if (changed) await save();
  }, [active, save]);

  return { notes, unlocked: active !== null, unlocking, unlock, context, refresh, lock };
}
