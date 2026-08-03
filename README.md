# atrum-markets

The Atrum front end: a Next.js app over the shielded prediction-market protocol in
[`atrum-core`](../atrum-core). Lists markets, connects a wallet, and drives the full
lifecycle — deposit → bet → resolve → settle → redeem → withdraw — against a live Monad
testnet deployment.

Everything on screen is read from the chain or measured from the circuit artefacts on disk.
There are no placeholder figures; see "Nothing is mocked" below for why that is stated
explicitly.

---

## Read this first: proving runs on the server

**The server sees every note secret.** Spending a note requires its `nullifier` and `secret`
to build a witness, and today the browser sends them to an API route that proves and relays.
So:

- a server compromise reveals every user's positions and can spend their notes;
- note storage is server-side too (`.data/notes.json`, keyed by owner address behind a
  signature-derived session), which adds no assumption that server-side proving had not
  already forced, and buys multi-device access.

The production design is the opposite — the browser holds its own secrets and proves locally.
`atrum-core/HANDOFF.md` §0-bis measured that this is viable (29.7MB of artefacts cached in
IndexedDB; `bet_encrypted` at 1.83s in a browser) and concluded proving must run in a Web
Worker. That is not built. **Until it is, treat this as custodial.** The UI says so on the
market and boundary pages rather than burying it.

## Who signs what

| action | signed by | gas | why |
|---|---|---|---|
| `deposit` | the user's wallet | the user | `transferFrom(msg.sender)` — relaying it would move the payment link one hop, not remove it. Public **by design**: this is the boundary. |
| `betEncrypted`, `redeemPrivate`, `withdraw` | a relayer | the operator | these are proof-gated, never sender-gated, so the user's address never appears beside their own action. |

Verified on chain, not asserted: a fresh wallet running the whole flow ends with nonce 3 —
its mint, approve and deposit — while its bet's `from` is a relay account.

The relayer knows it was you. Trust is relocated, not removed.

## Running it

Needs `atrum-core` checked out beside this repo, with `circuits/build/` populated
(`make circuits`) and a pool deployed from that same tree.

```bash
# 1. the sequencer (in atrum-core/sequencer) -- batches commitments AND relays actions
node --experimental-strip-types src/main.ts

# 2. this app
cp .env.example .env.local   # then fill it in
npm install
npm run dev                  # http://localhost:3000/markets
```

A user needs a little testnet MON for gas to deposit ([faucet.monad.xyz](https://faucet.monad.xyz));
the collateral is a mock USDC with a permissionless `mint`, so the app can faucet it directly.
After depositing, betting/redeeming/withdrawing cost the user no gas at all.

## How it is put together

```
src/server/atrum/     server-only: chain reads, proving, relaying, notes, auth
  markets.ts          live market + pool state, re-read per request
  registry.ts         the market id list (see below)
  prove.ts            Groth16 against atrum-core/circuits/build
  relay.ts            POSTs proof-gated actions to the sequencer
  circuits.ts         constraint counts parsed from .r1cs headers
  auth.ts             signature -> HMAC session cookie
  noteStore.ts        per-owner notes
  actions/            deposit / bet / redeem / withdraw / admin
src/lib/atrum/        client: wallet provider, API client, app state
src/app/api/atrum/    route handlers
markets.json          market id registry
```

### Markets come from a registry file

`ShieldedPool` cannot enumerate its own markets — there is no array, only `marketVault[id]` —
and the project forbids building on `eth_getLogs` (the public Monad RPC caps range at 100
blocks). `atrum-core/circuits/scripts/seed-markets.mjs` creates markets and writes
`markets.json`.

It is a **cache of ids, not a source of truth.** Betting window, outcome and settled totals
are re-read from the vault on every request, so a stale or tampered registry can only list or
omit a market — never misstate one.

### Nothing is mocked

This UI was ported from a design mock that carried invented figures, and they were not
harmless: two contradicted the protocol. A "constraints satisfied" counter animated to
1,048,576 for a 21,252-constraint circuit, and stakes were labelled `MON` when the collateral
is a 6-decimal USDC mock. All of it is gone.

Consequently: constraint counts and key sizes are parsed from the `.r1cs`/`.zkey` on disk at
request time, the anonymity floor is read from `ShieldedPool.minAnonymitySet`, the token
symbol and decimals come from the token, and the queue figures are live `queuedCount` /
`batchCount`.

There is also **no progress bar** during proving. The prover reports no progress, so a bar
would be a decorative lie about how far along it is; the overlay shows the real step and a
real elapsed clock, and says why.

## Known gaps

- **Server-side proving** — the big one, above.
- **The live odds ratio is decrypted server-side for display.** No publisher service exists
  yet, so the app holds the disclosed committee secret. This is exactly the leak
  `HANDOFF.md` documents: a precise, continuously-updated ratio is a sequence of equations in
  the running sums. Real deployments publish coarsely and on a cadence.
- **Seeded markets name an EOA as resolver**, so outcomes can be driven on demand.
  `PythResolver` exists and is deployed; the operator panel is shown rather than hidden,
  because hiding it would not make the market trustless.
- **Sign-in nonces can be replayed** — they are echoed by the client rather than tracked
  server-side. A session only grants access to notes the signer already owns, but production
  needs server-issued single-use nonces.
- **Relaying spends operator gas.** Monad bills the full declared `ACTION_GAS_LIMIT`
  (2,500,000) regardless of use, roughly 0.5 MON per action. The relay accounts and the
  sequencer's batching account both need watching — the batching account running dry stalls
  every graft.
