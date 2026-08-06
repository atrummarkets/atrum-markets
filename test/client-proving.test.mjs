/**
 * Regression suite for browser-side proving.
 *
 * Runs the REAL client modules under Node (see `alias-loader.mjs` and `browser-shims.mjs`),
 * so what is checked here is the code that ships, not a restatement of it.
 *
 * THE CENTRAL QUESTION IT ANSWERS: does a witness built in the browser satisfy the same
 * circuits the server-side path satisfied? A proof that verifies against the deployed
 * verifying key is the only honest answer, so every action test ends in
 * `snarkjs.groth16.verify` rather than in "it did not throw".
 *
 * Run: node --experimental-strip-types --import ./test/setup.mjs test/client-proving.test.mjs
 * (or `npm run test:client`).
 */
import { readFileSync, writeSync } from "node:fs";
import { join } from "node:path";
import * as snarkjs from "snarkjs";
import { onApi } from "./browser-shims.mjs";

import {
  init,
  noteCommitment,
  nullifierHash,
  packMarketMeta,
  packRedeemMeta,
  packWithdrawData,
  MerkleTree,
  FIELD_SIZE,
} from "../src/server/atrum/atrum.mjs";
import { buildElGamal } from "../src/server/atrum/elgamal.mjs";

import {
  Vault,
  VAULT_MESSAGE,
  deriveSeed,
  deriveNoteSecrets,
  encryptBlob,
  decryptBlob,
} from "../src/lib/atrum/client/vault.ts";
import * as actions from "../src/lib/atrum/client/actions.ts";
import { terminateProver } from "../src/lib/atrum/client/prover.ts";
import { resetTree, mirroredLeafCount, syncTree, pathFor } from "../src/lib/atrum/client/tree.ts";

const ROOT = join(import.meta.dirname, "..");
const BUILD = join(ROOT, "circuits-build");

// ---------------------------------------------------------------------------
// Tiny harness
// ---------------------------------------------------------------------------

/**
 * Written with `writeSync(1, ...)` rather than `console.log`.
 *
 * Node fully buffers stdout when it is a pipe or a file, so a run that takes minutes shows
 * nothing at all until it exits -- and a hang then looks identical to slow progress, which is
 * exactly the wrong signal while proving 30 Groth16 proofs. This flushes every line.
 */
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
    failures.push({ name, error });
    say(`  FAIL ${name}\n       ${error.message}`);
  }
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (String(actual) !== String(expected)) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

async function assertRejects(fn, fragment, message) {
  try {
    await fn();
  } catch (error) {
    assert(
      error.message.includes(fragment),
      `${message}: expected an error containing "${fragment}", got "${error.message}"`,
    );
    return;
  }
  throw new Error(`${message}: expected it to throw, it resolved`);
}

/** A fixed signature stands in for the wallet -- the vault only ever sees the hex string. */
const SIG_A = `0x${"11".repeat(65)}`;
const SIG_B = `0x${"22".repeat(65)}`;

function committeePubKey() {
  const env = readFileSync(join(ROOT, ".env.local"), "utf8");
  const line = env.split("\n").find((l) => l.startsWith("COMMITTEE_KEY_JSON="));
  if (!line) throw new Error("COMMITTEE_KEY_JSON missing from .env.local");
  return JSON.parse(line.slice("COMMITTEE_KEY_JSON=".length)).pubKey;
}

function verifyProof(circuit, proof, publicSignals) {
  const vkey = JSON.parse(readFileSync(join(BUILD, `${circuit}_vkey.json`), "utf8"));
  // Reassembled from calldata form back into snarkjs's proof shape, undoing the G2 limb swap
  // `exportSolidityCallData` applies. If this reassembly is wrong the proof fails to verify,
  // which is exactly the failure a mis-encoded pB would cause on chain.
  const p = {
    pi_a: [proof.pA[0], proof.pA[1], "1"],
    pi_b: [
      [proof.pB[0][1], proof.pB[0][0]],
      [proof.pB[1][1], proof.pB[1][0]],
      ["1", "0"],
    ],
    pi_c: [proof.pC[0], proof.pC[1], "1"],
    protocol: "groth16",
    curve: "bn128",
  };
  return snarkjs.groth16.verify(vkey, publicSignals, p);
}

// ---------------------------------------------------------------------------
// A vault context backed by an in-memory "server"
// ---------------------------------------------------------------------------

function makeServer() {
  // Module-level mirror in `tree.ts`, so it must be dropped between scenarios or a later
  // test inherits an earlier one's leaves.
  resetTree();
  const state = {
    blob: null,
    tree: new MerkleTree(),
    relayed: [],
    /** Set to an Error to make the next relay fail, exercising the rollback path. */
    relayError: null,
    /** Every `?since=` the client asked for. Used to assert it never names a commitment. */
    leafRequests: [],
  };

  onApi(async (url, init) => {
    const body = init?.body ? JSON.parse(init.body) : null;

    if (url === "/api/atrum/vault" && (!init || init.method === undefined)) {
      return Response.json({ blob: state.blob });
    }
    if (url === "/api/atrum/vault" && init?.method === "PUT") {
      state.blob = body.blob;
      return Response.json({ ok: true });
    }
    if (url.startsWith("/api/atrum/leaves")) {
      const since = Number(new URL(url, "http://x").searchParams.get("since") ?? "0");
      state.leafRequests.push(since);
      return Response.json({
        since,
        total: state.tree.leaves.length,
        root: state.tree.root().toString(),
        leaves: state.tree.leaves.slice(since).map(String),
      });
    }
    if (url === "/api/atrum/relay") {
      if (state.relayError) {
        const err = state.relayError;
        state.relayError = null;
        return Response.json({ error: err }, { status: 400 });
      }
      state.relayed.push(body);
      return Response.json({ hash: `0x${"ab".repeat(32)}`, relayer: "0xrelayer", gasUsed: "123" });
    }
    throw new Error(`unexpected request ${init?.method ?? "GET"} ${url}`);
  });

  return state;
}

async function makeContext(server, signature = SIG_A) {
  const vault = await Vault.unlock(signature, server.blob);
  return {
    vault,
    save: async () => {
      const sealed = await vault.seal();
      server.blob = sealed;
    },
    committeePubKey: committeePubKey(),
  };
}

// ---------------------------------------------------------------------------

say("\nclient-side proving\n");
await init();

// --- key derivation -------------------------------------------------------

say("key derivation");

await test("the same signature always derives the same seed", async () => {
  const a = await deriveSeed(SIG_A);
  const b = await deriveSeed(SIG_A);
  assertEqual(Buffer.from(a).toString("hex"), Buffer.from(b).toString("hex"), "seeds differ");
});

await test("a different signature derives a different seed", async () => {
  const a = await deriveSeed(SIG_A);
  const b = await deriveSeed(SIG_B);
  assert(Buffer.from(a).toString("hex") !== Buffer.from(b).toString("hex"), "seeds collided");
});

await test("note secrets are deterministic per index and differ across indices", async () => {
  const seed = await deriveSeed(SIG_A);
  const n0 = await deriveNoteSecrets(seed, 0);
  const again = await deriveNoteSecrets(seed, 0);
  const n1 = await deriveNoteSecrets(seed, 1);

  assertEqual(n0.nullifier, again.nullifier, "index 0 nullifier is not stable");
  assertEqual(n0.secret, again.secret, "index 0 secret is not stable");
  assert(n0.nullifier !== n1.nullifier, "indices 0 and 1 share a nullifier");
  assert(n0.nullifier !== n0.secret, "nullifier and secret are the same value");
});

await test("derived secrets are inside the field", async () => {
  const seed = await deriveSeed(SIG_A);
  for (let i = 0; i < 32; i++) {
    const { nullifier, secret } = await deriveNoteSecrets(seed, i);
    assert(nullifier > 0n && nullifier < FIELD_SIZE, `nullifier ${i} out of field`);
    assert(secret > 0n && secret < FIELD_SIZE, `secret ${i} out of field`);
  }
});

// --- blob encryption ------------------------------------------------------

say("\nblob encryption");

await test("a blob round-trips", async () => {
  const seed = await deriveSeed(SIG_A);
  const blob = { version: 1, nextIndex: 3, notes: [] };
  const back = await decryptBlob(seed, await encryptBlob(seed, blob));
  assertEqual(back.nextIndex, 3, "nextIndex did not survive");
});

await test("the wrong seed cannot decrypt", async () => {
  const a = await deriveSeed(SIG_A);
  const b = await deriveSeed(SIG_B);
  const sealed = await encryptBlob(a, { version: 1, nextIndex: 0, notes: [] });
  await assertRejects(() => decryptBlob(b, sealed), "", "decrypted under the wrong key");
});

await test("encryption is non-deterministic (fresh GCM nonce per write)", async () => {
  const seed = await deriveSeed(SIG_A);
  const blob = { version: 1, nextIndex: 0, notes: [] };
  const one = await encryptBlob(seed, blob);
  const two = await encryptBlob(seed, blob);
  assert(one !== two, "two encryptions of the same blob are byte-identical -- nonce is reused");
});

await test("a tampered ciphertext is rejected, not silently accepted", async () => {
  const seed = await deriveSeed(SIG_A);
  const sealed = await encryptBlob(seed, { version: 1, nextIndex: 7, notes: [] });
  const [iv, ct] = sealed.split(".");
  const bytes = Buffer.from(ct, "base64");
  bytes[0] ^= 0xff;
  await assertRejects(
    () => decryptBlob(seed, `${iv}.${bytes.toString("base64")}`),
    "",
    "GCM accepted a tampered blob",
  );
});

await test("unlock refuses to silently start a fresh vault over an unreadable one", async () => {
  const sealed = await encryptBlob(await deriveSeed(SIG_A), { version: 1, nextIndex: 5, notes: [] });
  await assertRejects(
    () => Vault.unlock(SIG_B, sealed),
    "could not be decrypted",
    "a mismatched signature silently produced an empty vault",
  );
});

await test("unlock with no stored blob starts empty", async () => {
  const vault = await Vault.unlock(SIG_A, null);
  assertEqual(vault.notes.length, 0, "fresh vault is not empty");
});

// --- index allocation -----------------------------------------------------

say("\nindex allocation");

await test("indices are never handed out twice", async () => {
  const vault = await Vault.unlock(SIG_A, null);
  const seen = new Set();
  for (let i = 0; i < 50; i++) {
    const { index } = await vault.allocate();
    assert(!seen.has(index), `index ${index} was allocated twice`);
    seen.add(index);
  }
});

await test("the counter survives a seal/unlock cycle", async () => {
  const seed = await deriveSeed(SIG_A);
  const first = await Vault.unlock(SIG_A, null);
  await first.allocate();
  await first.allocate();
  const reopened = await Vault.unlock(SIG_A, await first.seal());
  const { index } = await reopened.allocate();
  assertEqual(index, 2, "reopened vault reused an index");
  void seed;
});

await test("secretsFor a stored note reproduces its allocation secrets", async () => {
  const vault = await Vault.unlock(SIG_A, null);
  const { index, nullifier, secret } = await vault.allocate();
  vault.add({
    id: "abc",
    index,
    commitment: "1",
    marketId: "0",
    outcome: 0,
    units: "100",
    status: "grafted",
    label: "t",
    createdAt: Date.now(),
  });
  const back = await vault.secretsFor(vault.note("abc"));
  assertEqual(back.nullifier, nullifier, "nullifier did not reproduce");
  assertEqual(back.secret, secret, "secret did not reproduce");
});

// --- the four actions, each ending in a verified proof --------------------

say("\nactions (each builds a real Groth16 proof and verifies it)");

const UNITS = 100n;
const MARKET = 7;

/** Deposit, and graft the resulting note so later actions have something spendable. */
async function depositInto(server, ctx, units = Number(UNITS)) {
  const prepared = await actions.prepareDeposit(ctx, units);
  server.tree.insert(BigInt(prepared.commitment));
  ctx.vault.update(prepared.id, { status: "grafted" });
  await ctx.save();
  return prepared;
}

await test("deposit produces a proof that verifies", async () => {
  const server = makeServer();
  const ctx = await makeContext(server);
  const prepared = await actions.prepareDeposit(ctx, Number(UNITS));

  const ok = await verifyProof("deposit", prepared, [prepared.commitment, String(UNITS)]);
  assert(ok, "the deposit proof did not verify against deposit_vkey.json");
  assertEqual(ctx.vault.notes.length, 1, "the note was not recorded");
  assertEqual(ctx.vault.note(prepared.id).status, "queued", "a fresh deposit should be queued");
});

await test("deposit rejects a non-denomination before proving", async () => {
  const server = makeServer();
  const ctx = await makeContext(server);
  await assertRejects(
    () => actions.prepareDeposit(ctx, 37),
    "not a denomination",
    "37 units was accepted",
  );
});

await test("bet produces a proof that verifies, and relays it", async () => {
  const server = makeServer();
  const ctx = await makeContext(server);
  const deposited = await depositInto(server, ctx);

  const result = await actions.bet(ctx, deposited.id, MARKET, "yes");

  assertEqual(server.relayed.length, 1, "the bet was not relayed");
  assertEqual(server.relayed[0].action, "betEncrypted", "wrong relay action");

  const relayArgs = server.relayed[0].args;
  const root = relayArgs[0];
  const nullifierHashArg = relayArgs[1];
  const newCommitment = relayArgs[2];
  const betMeta = relayArgs[3];
  const cipher = relayArgs[4];

  assertEqual(betMeta, packMarketMeta(BigInt(MARKET), 1n), "betMeta is wrong for a YES bet");

  const ok = await verifyProof("bet_encrypted", server.relayed[0], [
    root,
    nullifierHashArg,
    newCommitment,
    betMeta,
    ...cipher,
  ]);
  assert(ok, "the bet proof did not verify against bet_encrypted_vkey.json");

  assertEqual(ctx.vault.note(deposited.id).status, "spent", "the spent note was not marked spent");
  assertEqual(ctx.vault.note(result.id).units, String(UNITS), "the position note has the wrong size");
});

await test("the bet ciphertext really decrypts to the stake", async () => {
  const server = makeServer();
  const ctx = await makeContext(server);
  const deposited = await depositInto(server, ctx);
  await actions.bet(ctx, deposited.id, MARKET, "no");

  const env = readFileSync(join(ROOT, ".env.local"), "utf8");
  const line = env.split("\n").find((l) => l.startsWith("COMMITTEE_KEY_JSON="));
  const key = JSON.parse(line.slice("COMMITTEE_KEY_JSON=".length));
  const elgamal = await buildElGamal(key.pubKey, key.secret);

  const [c1x, c1y, c2x, c2y] = server.relayed[0].args[4].map(BigInt);
  const c1 = [elgamal.F.e(c1x), elgamal.F.e(c1y)];
  const c2 = [elgamal.F.e(c2x), elgamal.F.e(c2y)];
  assertEqual(elgamal.decrypt(c1, c2, 10_000n), UNITS, "the ciphertext does not hold the stake");
});

await test("redeem produces a proof that verifies, with correct parimutuel arithmetic", async () => {
  const server = makeServer();
  const ctx = await makeContext(server);
  const deposited = await depositInto(server, ctx);
  const position = await actions.bet(ctx, deposited.id, MARKET, "yes");

  server.tree.insert(BigInt(ctx.vault.note(position.id).commitment));
  ctx.vault.update(position.id, { status: "grafted" });
  await ctx.save();

  // YES 100 of a 250 pool: payout = 100 * 250 / 100 = 250.
  const market = { yesUnits: 100, noUnits: 150, settled: true };
  const result = await actions.redeem(ctx, position.id, market);

  assertEqual(result.payout, "250", "payout is not units * totalPool / winningPool");

  const args = server.relayed[1].args;
  const ok = await verifyProof("redeem_private", server.relayed[1], [args[0], args[1], args[2], args[3]]);
  assert(ok, "the redeem proof did not verify against redeem_private_vkey.json");
  assertEqual(
    args[3],
    packRedeemMeta(BigInt(MARKET), 1n, 250n, 100n),
    "redeemMeta does not pin the settled totals",
  );
});

await test("redeem refuses an unsettled market and a losing side", async () => {
  const server = makeServer();
  const ctx = await makeContext(server);
  const deposited = await depositInto(server, ctx);
  const position = await actions.bet(ctx, deposited.id, MARKET, "yes");
  server.tree.insert(BigInt(ctx.vault.note(position.id).commitment));
  ctx.vault.update(position.id, { status: "grafted" });

  await assertRejects(
    () => actions.redeem(ctx, position.id, { yesUnits: 100, noUnits: 0, settled: false }),
    "not settled",
    "redeemed an unsettled market",
  );
  await assertRejects(
    () => actions.redeem(ctx, position.id, { yesUnits: 0, noUnits: 150, settled: true }),
    "did not win",
    "redeemed a losing position",
  );
});

await test("withdraw produces a proof that verifies, and keeps change as a note", async () => {
  const server = makeServer();
  const ctx = await makeContext(server);
  const deposited = await depositInto(server, ctx, 1000);

  const rung = { atRung: 8n, minAnonymitySet: 2n };
  const result = await actions.withdraw(ctx, deposited.id, 100, `0x${"cd".repeat(20)}`, rung);

  const args = server.relayed[0].args;
  const ok = await verifyProof("withdraw", server.relayed[0], [args[0], args[1], args[2], args[3]]);
  assert(ok, "the withdraw proof did not verify against withdraw_vkey.json");

  assertEqual(
    args[3],
    packWithdrawData(true, BigInt(`0x${"cd".repeat(20)}`), 100n),
    "withdrawData is packed wrong",
  );
  assert(result.changeId, "900 units of change produced no change note");
  assertEqual(ctx.vault.note(result.changeId).units, "900", "change note has the wrong size");
});

await test("withdraw refuses a thin denomination rung", async () => {
  const server = makeServer();
  const ctx = await makeContext(server);
  const deposited = await depositInto(server, ctx, 1000);
  await assertRejects(
    () => actions.withdraw(ctx, deposited.id, 100, `0x${"cd".repeat(20)}`, { atRung: 1n, minAnonymitySet: 8n }),
    "would name you",
    "withdrew onto a rung nobody else uses",
  );
});

await test("withdraw refuses a non-denomination amount and a bad recipient", async () => {
  const server = makeServer();
  const ctx = await makeContext(server);
  const deposited = await depositInto(server, ctx, 1000);
  const rung = { atRung: 8n, minAnonymitySet: 2n };

  await assertRejects(
    () => actions.withdraw(ctx, deposited.id, 250, `0x${"cd".repeat(20)}`, rung),
    "not a denomination",
    "withdrew a non-rung amount",
  );
  await assertRejects(
    () => actions.withdraw(ctx, deposited.id, 100, "not-an-address", rung),
    "not a valid address",
    "accepted a malformed recipient",
  );
});

// --- guards and rollback --------------------------------------------------

say("\nguards and rollback");

await test("a queued note cannot be spent", async () => {
  const server = makeServer();
  const ctx = await makeContext(server);
  const prepared = await actions.prepareDeposit(ctx, 100);
  await assertRejects(
    () => actions.bet(ctx, prepared.id, MARKET, "yes"),
    "still queued",
    "bet a note that has not grafted",
  );
});

await test("a spent note cannot be spent twice", async () => {
  const server = makeServer();
  const ctx = await makeContext(server);
  const deposited = await depositInto(server, ctx);
  await actions.bet(ctx, deposited.id, MARKET, "yes");
  await assertRejects(
    () => actions.bet(ctx, deposited.id, MARKET, "no"),
    "already spent",
    "double-spent a note",
  );
});

await test("a position note cannot be bet again", async () => {
  const server = makeServer();
  const ctx = await makeContext(server);
  const deposited = await depositInto(server, ctx);
  const position = await actions.bet(ctx, deposited.id, MARKET, "yes");
  server.tree.insert(BigInt(ctx.vault.note(position.id).commitment));
  ctx.vault.update(position.id, { status: "grafted" });
  await assertRejects(
    () => actions.bet(ctx, position.id, MARKET, "no"),
    "not unbet collateral",
    "bet an existing position",
  );
});

await test("a failed relay rolls the new note back out of the vault", async () => {
  const server = makeServer();
  const ctx = await makeContext(server);
  const deposited = await depositInto(server, ctx);

  const before = ctx.vault.notes.length;
  server.relayError = "sequencer is down";

  await assertRejects(() => actions.bet(ctx, deposited.id, MARKET, "yes"), "sequencer is down", "relay failure was swallowed");

  assertEqual(ctx.vault.notes.length, before, "the position note survived a failed relay");
  assertEqual(
    ctx.vault.note(deposited.id).status,
    "grafted",
    "the source note was marked spent despite the relay failing",
  );
});

await test("a failed relay leaves the source note spendable again", async () => {
  const server = makeServer();
  const ctx = await makeContext(server);
  const deposited = await depositInto(server, ctx);

  server.relayError = "boom";
  await assertRejects(() => actions.bet(ctx, deposited.id, MARKET, "yes"), "boom", "expected failure");

  const retry = await actions.bet(ctx, deposited.id, MARKET, "no");
  assert(retry.txHash, "the retry did not go through");
  assertEqual(ctx.vault.note(deposited.id).status, "spent", "the retry did not consume the note");
});

// --- the property the whole change exists for -----------------------------

say("\nthe privacy property");

await test("no secret ever reaches the server", async () => {
  const server = makeServer();
  const ctx = await makeContext(server);
  const deposited = await depositInto(server, ctx);
  const note = ctx.vault.note(deposited.id);
  const { nullifier, secret } = await ctx.vault.secretsFor(note);

  await actions.bet(ctx, deposited.id, MARKET, "yes");

  // Everything the client sent, concatenated: the encrypted vault plus every relay payload.
  const everythingSent = JSON.stringify(server.relayed) + String(server.blob);

  assert(!everythingSent.includes(nullifier.toString()), "the raw nullifier was transmitted");
  assert(!everythingSent.includes(secret.toString()), "the raw secret was transmitted");
});

await test("the stored vault blob is opaque -- no note metadata in the clear", async () => {
  const server = makeServer();
  const ctx = await makeContext(server);
  await depositInto(server, ctx);

  assert(!server.blob.includes("Deposit"), "the note label is readable in the stored blob");
  assert(!server.blob.includes("commitment"), "blob structure is readable in the clear");
  assert(/^[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/.test(server.blob), "blob is not in iv.ciphertext form");
});

await test("a second device reproduces the same notes from the signature alone", async () => {
  const server = makeServer();
  const first = await makeContext(server);
  const deposited = await depositInto(server, first);

  // Nothing carried over but the signature and whatever the server holds.
  const second = await makeContext(server, SIG_A);
  const sameNote = second.vault.note(deposited.id);
  assertEqual(sameNote.commitment, deposited.commitment, "the note did not survive the hop");

  const a = await first.vault.secretsFor(first.vault.note(deposited.id));
  const b = await second.vault.secretsFor(sameNote);
  assertEqual(b.nullifier, a.nullifier, "the second device derived different secrets");
  assertEqual(b.secret, a.secret, "the second device derived a different secret");
});

await test("no request ever names the commitment being spent", async () => {
  const server = makeServer();
  const ctx = await makeContext(server);
  const one = await depositInto(server, ctx);
  const two = await depositInto(server, ctx);

  await actions.bet(ctx, one.id, MARKET, "yes");

  // The whole point of serving leaves instead of paths: the server sees only offsets.
  for (const since of server.leafRequests) {
    assert(Number.isInteger(since) && since >= 0, `leaf request was not a plain offset: ${since}`);
  }
  const everythingAsked = JSON.stringify(server.leafRequests) + JSON.stringify(server.relayed.map((r) => r.args));
  assert(
    !everythingAsked.includes(one.commitment),
    "the spent commitment appeared in a request the client made before relaying",
  );
  void two;
});

await test("paths are derived locally and still satisfy the circuit", async () => {
  const server = makeServer();
  const ctx = await makeContext(server);
  const deposited = await depositInto(server, ctx);

  await actions.bet(ctx, deposited.id, MARKET, "yes");

  // The root the proof was built against is the locally computed one, and the bet proof
  // already verified above -- so the local tree agrees with the sequencer's.
  assertEqual(server.relayed[0].args[0], server.tree.root(), "local root disagrees with the mirror");
  assertEqual(mirroredLeafCount(), server.tree.leaves.length, "client mirrored the wrong leaf count");
});

await test("the mirror re-syncs incrementally rather than refetching everything", async () => {
  // Driven through syncTree directly rather than through bets: this is about request shape,
  // and it would otherwise cost two more multi-second proofs to observe.
  const server = makeServer();
  server.tree.insert(111n);
  await syncTree();
  assertEqual(server.leafRequests.at(-1), 0, "the first sync should start from zero");

  const before = server.leafRequests.length;
  server.tree.insert(222n);
  await syncTree();

  const offsets = server.leafRequests.slice(before);
  assertEqual(offsets.length, 1, "the second sync made more than one request");
  assertEqual(offsets[0], 1, "the second sync refetched from zero instead of asking for the tail");
  assertEqual(mirroredLeafCount(), 2, "the mirror lost or duplicated a leaf while syncing");
});

await test("a shrunken tree triggers a full rebuild, not an append onto a stale prefix", async () => {
  // The sequencer resets and rebuilds its mirror from chain (its `reset()`). Appending the
  // rebuilt tree onto the old prefix would serve paths for a tree that never existed, and
  // every proof built from them would fail verification with no diagnostic.
  const server = makeServer();
  server.tree.insert(111n);
  server.tree.insert(222n);
  await syncTree();
  assertEqual(mirroredLeafCount(), 2, "did not mirror both leaves");

  server.tree = new MerkleTree();
  server.tree.insert(999n);
  await syncTree();

  assertEqual(mirroredLeafCount(), 1, "the mirror appended onto a stale prefix");
  const path = await pathFor(999n);
  assertEqual(path.root, server.tree.root(), "rebuilt mirror disagrees with the sequencer");
});

await test("pathFor refuses a commitment that has not grafted", async () => {
  const server = makeServer();
  server.tree.insert(111n);
  await assertRejects(() => pathFor(424242n), "not been grafted", "produced a path for a missing leaf");
});

// --- commitment agreement -------------------------------------------------

say("\ncommitment agreement with atrum.mjs");

await test("a client-built deposit commitment matches noteCommitment directly", async () => {
  const server = makeServer();
  const ctx = await makeContext(server);
  const prepared = await actions.prepareDeposit(ctx, 100);
  const note = ctx.vault.note(prepared.id);
  const { nullifier, secret } = await ctx.vault.secretsFor(note);

  const expected = noteCommitment({
    nullifier,
    secret,
    marketId: 0n,
    outcome: 0n,
    units: 100n,
  });
  assertEqual(prepared.commitment, expected, "the client and atrum.mjs disagree on a commitment");
});

await test("the relayed nullifier hash matches nullifierHash of the spent note", async () => {
  const server = makeServer();
  const ctx = await makeContext(server);
  const deposited = await depositInto(server, ctx);
  const { nullifier } = await ctx.vault.secretsFor(ctx.vault.note(deposited.id));

  await actions.bet(ctx, deposited.id, MARKET, "yes");
  assertEqual(server.relayed[0].args[1], nullifierHash(nullifier), "nullifier hash disagrees");
});

// ---------------------------------------------------------------------------

terminateProver();

say(`\n${passed} passed, ${failures.length} failed\n`);

/**
 * snarkjs builds a global bn128 curve backed by its own worker threads and never tears it
 * down. Those threads keep the event loop alive, so without this the suite finishes its work
 * and then hangs forever at 0% CPU -- which is precisely how it presented the first time.
 */
await globalThis.curve_bn128?.terminate();
process.exit(failures.length > 0 ? 1 : 0);
