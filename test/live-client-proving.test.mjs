/**
 * Client-side proving against the REAL stack.
 *
 * `client-proving.test.mjs` proves the logic with an in-memory server. This proves the
 * integration: real API routes, the real sequencer, the real chain, the real relayer, and --
 * most importantly -- real notes created under server-side proving, adopted into a vault and
 * then spent.
 *
 * Only `caches` and `Worker` are shimmed, because Node has neither. Everything else is live.
 *
 * Usage (dev server must be running with NEXT_PUBLIC_CLIENT_PROVING=1):
 *   node --experimental-strip-types --import ./test/setup.mjs test/live-client-proving.test.mjs
 */
import { writeSync, readFileSync } from "node:fs";
import { privateKeyToAccount } from "viem/accounts";

import { Vault, VAULT_MESSAGE } from "../src/lib/atrum/client/vault.ts";
import * as actions from "../src/lib/atrum/client/actions.ts";
import { terminateProver } from "../src/lib/atrum/client/prover.ts";
import { resetTree } from "../src/lib/atrum/client/tree.ts";
import { init, noteCommitment } from "../src/server/atrum/atrum.mjs";

const BASE = "http://localhost:3000";

function say(line = "") {
  writeSync(1, `${line}\n`);
}

let passed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed++;
    say(`  ok   ${name}`);
  } catch (error) {
    failures.push(name);
    say(`  FAIL ${name}\n       ${error.message}`);
  }
}

const assert = (c, m) => {
  if (!c) throw new Error(m);
};
const assertEqual = (a, e, m) => {
  if (String(a) !== String(e)) throw new Error(`${m}: expected ${e}, got ${a}`);
};

/**
 * The browser shims intercept every fetch. For this suite the app calls must go through to the
 * real dev server, so absolute-ise them and let Node's fetch handle it.
 */
// Node's own fetch, stashed by browser-shims before it replaced the global.
const realFetch = globalThis.__realFetch ?? globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = typeof input === "string" ? input : input.url;
  if (url.startsWith("/api/")) return realFetch(`${BASE}${url}`, init);
  if (url.startsWith("/circuits/")) return realFetch(`${BASE}${url}`, init);
  return realFetch(input, init);
};

/** Sign in the way the browser does: server nonce, personal_sign, session cookie. */
async function signIn(account) {
  const { nonce, message } = await (await fetch(`${BASE}/api/atrum/auth/nonce`)).json();
  const signature = await account.signMessage({ message });
  const res = await fetch(`${BASE}/api/atrum/auth/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address: account.address, nonce, signature }),
  });
  if (!res.ok) throw new Error(JSON.stringify(await res.json()));
  return res.headers.getSetCookie().find((c) => c.startsWith("atrum_session="))?.split(";")[0];
}

/**
 * The app relies on cookies being sent automatically. Node's fetch has no cookie jar, so the
 * session is pinned onto every request for the duration of a wallet's turn.
 */
function useSession(cookie) {
  const withCookie = globalThis.fetch;
  globalThis.fetch = (input, init = {}) =>
    withCookie(input, { ...init, headers: { ...(init.headers ?? {}), cookie } });
  return () => {
    globalThis.fetch = withCookie;
  };
}

say("\nclient-side proving, against the live stack\n");
await init();

const keys = JSON.parse(readFileSync("scripts/bet-storm-keys.json", "utf8"));

// A wallet that genuinely holds unspent notes created under SERVER-SIDE proving. Adopting and
// spending one of those is the whole point -- it is what a real user's first visit will do.
const account = privateKeyToAccount(keys[3]);
say(`wallet ${account.address}`);

const cookie = await signIn(account);
assert(cookie, "sign-in produced no session");
const release = useSession(cookie);
resetTree();

// --- what the server-proving era left for this wallet ---------------------

const legacy = await (await fetch("/api/atrum/vault/import")).json();
say(`\nserver-era notes offered for import: ${legacy.notes.length}`);
for (const n of legacy.notes) say(`  0x${n.id} ${n.units}u outcome=${n.outcome} ${n.status}`);

await test("the import endpoint returns notes WITH their secrets", () => {
  assert(legacy.notes.length > 0, "this wallet has no legacy notes to test with");
  for (const n of legacy.notes) {
    assert(n.nullifier && n.secret, `note 0x${n.id} came back without secrets`);
  }
});

await test("it never offers a spent note", () => {
  assert(
    legacy.notes.every((n) => n.status !== "spent"),
    "a spent note was offered, which could only ever revert as NullifierAlreadySpent",
  );
});

await test("the offered secrets actually reconstruct each commitment", () => {
  // The real check that these are usable: the commitment has to fall out of the secrets.
  for (const n of legacy.notes) {
    const rebuilt = noteCommitment({
      nullifier: BigInt(n.nullifier),
      secret: BigInt(n.secret),
      marketId: BigInt(n.marketId),
      outcome: BigInt(n.outcome),
      units: BigInt(n.units),
    });
    assertEqual(rebuilt, n.commitment, `note 0x${n.id} secrets do not rebuild its commitment`);
  }
});

// --- unlocking a vault, exactly as the browser would ----------------------

const signature = await account.signMessage({ message: VAULT_MESSAGE });

await test("this wallet signs deterministically, so it can hold a vault", async () => {
  const again = await account.signMessage({ message: VAULT_MESSAGE });
  assertEqual(again, signature, "signature differs between calls -- the guard would reject this wallet");
});

const stored = await (await fetch("/api/atrum/vault")).json();
const vault = await Vault.unlock(signature, stored.blob ?? null);

await test("a fresh vault adopts the server-era notes", async () => {
  assert(!vault.hasImportedLegacy || stored.blob, "expected an un-imported vault on first run");
  if (!vault.hasImportedLegacy) {
    const added = vault.adoptLegacy(
      legacy.notes.map(({ nullifier, secret, ...rest }) => ({
        ...rest,
        imported: { nullifier, secret },
      })),
    );
    assertEqual(added, legacy.notes.length, "not every legacy note was adopted");
  }
  assert(vault.hasImportedLegacy, "adoption was not recorded");
});

const ctx = {
  vault,
  save: async () => {
    const res = await fetch("/api/atrum/vault", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ blob: await vault.seal() }),
    });
    if (!res.ok) throw new Error(`vault PUT -> ${res.status}`);
  },
  committeePubKey: (await (await fetch("/api/atrum/config")).json()).committeePubKey,
};

await test("the sealed vault round-trips through the real server", async () => {
  await ctx.save();
  const back = await (await fetch("/api/atrum/vault")).json();
  assert(back.blob, "the server did not store the vault");
  const reopened = await Vault.unlock(signature, back.blob);
  assertEqual(reopened.notes.length, vault.notes.length, "note count changed across the round trip");
  assert(reopened.hasImportedLegacy, "the imported flag did not survive the server");
});

await test("the stored blob is opaque to the server", async () => {
  const back = await (await fetch("/api/atrum/vault")).json();
  for (const n of legacy.notes) {
    assert(!back.blob.includes(n.nullifier), `note 0x${n.id} nullifier is readable in the stored blob`);
    assert(!back.blob.includes(n.secret), `note 0x${n.id} secret is readable in the stored blob`);
  }
});

// --- spending an adopted note, for real -----------------------------------

const spendable = vault.notes.find((n) => n.status === "grafted" && n.outcome === 0);
const market = (await (await fetch("/api/atrum/markets")).json()).markets.find(
  (m) => m.phase === "betting",
);

if (!spendable) {
  say("\n  (no grafted unbet note on this wallet -- skipping the live spend)");
} else if (!market) {
  say("\n  (no market open for betting -- skipping the live spend)");
} else {
  say(`\nspending adopted note 0x${spendable.id} (${spendable.units}u) on market #${market.marketId}`);

  await test("an ADOPTED note bets for real: proved in-process, relayed on chain", async () => {
    const result = await actions.bet(ctx, spendable.id, market.marketId, "yes");
    assert(result.txHash?.startsWith("0x"), "no transaction hash came back");
    assert(result.relayer?.startsWith("0x"), "no relayer address came back");
    say(`       tx ${result.txHash}`);
    say(`       relayer ${result.relayer}, proving ${result.provingMs}ms`);
    assertEqual(
      vault.note(spendable.id).status,
      "spent",
      "the adopted note was not marked spent after a successful bet",
    );
  });
}

release();
terminateProver();

say(`\n${passed} passed, ${failures.length} failed\n`);
await globalThis.curve_bn128?.terminate();
process.exit(failures.length > 0 ? 1 : 0);
