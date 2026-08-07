/**
 * Generate N fresh wallets, fund them from the operator key, and drive each one through
 * the REAL client flow this app exposes over HTTP: mint test collateral, sign in, deposit
 * (self-signed, matching the "deposit is public by design" boundary), wait for its note to
 * graft, then bet a random side -- relayed, so the wallet never pays gas for that part and
 * never appears on that transaction.
 *
 * Deliberately talks to the running app's own API (localhost:3000 by default) rather than
 * reimplementing deposit/bet -- a second implementation of that flow is exactly how a script
 * like this drifts from what real users experience.
 *
 * Usage:
 *   PRIVATE_KEY=0x... node scripts/bet-storm.mjs [count] [marketId] [units]
 *   count     default 6
 *   marketId  default: auto-picks the open market with the most time left to bet
 *   units     default 100 (must be a valid denomination: 1, 10, 100, ...)
 *
 * Env:
 *   PRIVATE_KEY   operator key that funds the new wallets (required)
 *   RPC_URL       default https://rpc.ankr.com/monad_testnet -- chosen on measurement this
 *                 session, not preference: it is the endpoint verified to accept writes
 *                 when another (Alchemy) falsely reported "insufficient balance".
 *   BASE_URL      default http://localhost:3000
 *   FUND_MON      MON sent to each new wallet, default 0.5
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  defineChain,
  parseEther,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Persisted immediately after generation, before anything can fail. Losing an in-memory-only
// key mid-run is not recoverable -- the wallet can never sign in again, and whatever it
// already deposited is orphaned for good (real on funded testnet MON, if not real value).
const KEYS_PATH = join(dirname(fileURLToPath(import.meta.url)), "bet-storm-keys.json");

const COUNT = Number(process.argv[2] ?? 6);
const MARKET_ARG = process.argv[3] ? Number(process.argv[3]) : null;
const UNITS = BigInt(process.argv[4] ?? 100);

const RPC_URL = process.env.RPC_URL ?? "https://rpc.ankr.com/monad_testnet";
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const FUND_MON = process.env.FUND_MON ?? "0.5";

const OPERATOR_KEY = process.env.PRIVATE_KEY;
if (!OPERATOR_KEY) {
  console.error("missing PRIVATE_KEY (the operator key that funds the new wallets)");
  process.exit(1);
}

const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

const publicClient = createPublicClient({ chain: monadTestnet, transport: http() });
const operator = createWalletClient({
  chain: monadTestnet,
  transport: http(),
  account: privateKeyToAccount(OPERATOR_KEY),
});

const DEPOSIT_ABI = parseAbi([
  "function deposit(uint256[2] pA, uint256[2][2] pB, uint256[2] pC, uint256 commitment, uint256 units)",
]);
const ERC20_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function mint(address,uint256)",
]);

function log(i, addr, msg) {
  console.log(`[${i}] ${addr.slice(0, 8)}  ${msg}`);
}

async function api(path, cookie, init = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...init.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${body.error ?? "unknown error"}`);
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const newCookie = setCookie.find((c) => c.startsWith("atrum_session="))?.split(";")[0];
  return { body, cookie: newCookie ?? cookie };
}

async function pickMarket() {
  if (MARKET_ARG !== null) return MARKET_ARG;
  const { body } = await api("/api/atrum/markets", null);
  const now = Math.floor(Date.now() / 1000);
  const open = body.markets.filter((m) => m.phase === "betting");
  if (open.length === 0) throw new Error("no market is currently open for betting");
  open.sort((a, b) => b.bettingCloseTime - now - (a.bettingCloseTime - now));
  const picked = open[open.length - 1];
  console.log(
    `auto-picked market #${picked.marketId} (${Math.round((picked.bettingCloseTime - now) / 60)}m left): ${picked.question}`,
  );
  return picked.marketId;
}

async function runWallet(i, account, marketId, config) {
  const wallet = createWalletClient({ chain: monadTestnet, transport: http(), account });
  const addr = account.address;

  // The funding tx's own receipt confirmed, but this RPC's read path can still lag behind
  // its write path by a beat -- same class of stale-balance issue documented in
  // sequencer/src/chains.ts for flushBatch, here hitting a plain ERC20 mint instead. Confirm
  // the balance is actually visible before spending it, rather than fail and blame the chain.
  for (let attempt = 0; ; attempt++) {
    const bal = await publicClient.getBalance({ address: addr });
    if (bal > 0n) break;
    if (attempt >= 10) throw new Error("funding never became visible on this RPC after 10 checks");
    await new Promise((r) => setTimeout(r, 2000));
  }

  // --- mint test collateral to itself (permissionless on this mock) ---
  const raw = UNITS * BigInt(config.poolState.denomination);
  const mintHash = await wallet.writeContract({
    address: config.collateral,
    abi: ERC20_ABI,
    functionName: "mint",
    args: [addr, raw],
    chain: monadTestnet,
    account,
  });
  await publicClient.waitForTransactionReceipt({ hash: mintHash });
  log(i, addr, `minted ${UNITS} ${config.token.symbol}`);

  // --- sign in: prove control of this address, no transaction, no gas ---
  const { body: n } = await api("/api/atrum/auth/nonce", null);
  const signature = await wallet.signMessage({ message: n.message });
  const { cookie } = await api("/api/atrum/auth/verify", null, {
    method: "POST",
    body: JSON.stringify({ address: addr, nonce: n.nonce, signature }),
  });
  log(i, addr, "signed in");

  // --- deposit: server builds the proof, THIS WALLET submits it ---
  const { body: prepared } = await api("/api/atrum/deposit/prepare", cookie, {
    method: "POST",
    body: JSON.stringify({ units: Number(UNITS) }),
  });

  const approveHash = await wallet.writeContract({
    address: config.collateral,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [config.pool, raw],
    chain: monadTestnet,
    account,
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });

  const depositHash = await wallet.writeContract({
    address: config.pool,
    abi: DEPOSIT_ABI,
    functionName: "deposit",
    args: [
      prepared.pA.map(BigInt),
      prepared.pB.map((r) => r.map(BigInt)),
      prepared.pC.map(BigInt),
      BigInt(prepared.commitment),
      BigInt(prepared.units),
    ],
    // Declared explicitly, never estimated -- a wallet's auto-estimate undershot this
    // action's real ~1.8M-gas cost against this exact deposit call once already this
    // session and reverted out of gas. See marketContext.tsx's deposit() for the same fix.
    gas: 2_200_000n,
    chain: monadTestnet,
    account,
  });
  const depositReceipt = await publicClient.waitForTransactionReceipt({ hash: depositHash });
  if (depositReceipt.status !== "success") throw new Error("deposit reverted");
  await api("/api/atrum/deposit/confirm", cookie, {
    method: "POST",
    body: JSON.stringify({ id: prepared.id, txHash: depositHash }),
  });
  log(i, addr, `deposited (note 0x${prepared.id})`);

  // --- wait for the note to graft ---
  const deadline = Date.now() + 6 * 60_000;
  let grafted = false;
  while (Date.now() < deadline) {
    const { body: notes } = await api("/api/atrum/notes", cookie);
    const note = notes.notes.find((n) => n.id === prepared.id);
    if (note?.status === "grafted") {
      grafted = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  if (!grafted) throw new Error("note never grafted within 6 minutes");
  log(i, addr, "note grafted");

  // --- bet: relayed. This wallet's address never appears on that transaction. ---
  const side = Math.random() < 0.5 ? "yes" : "no";
  const { body: result } = await api("/api/atrum/bet", cookie, {
    method: "POST",
    body: JSON.stringify({ noteId: prepared.id, marketId, side }),
  });
  log(i, addr, `bet ${side.toUpperCase()} -- tx ${result.txHash.slice(0, 10)}… via relayer ${result.relayer.slice(0, 10)}…`);

  return { address: addr, side, txHash: result.txHash };
}

async function main() {
  const { body: config } = await api("/api/atrum/config", null);
  const marketId = await pickMarket();

  console.log(`\n${COUNT} wallets, ${UNITS} units each, market #${marketId}, base ${BASE_URL}\n`);

  // Generate all accounts, then fund them with explicit sequential nonces from ONE call
  // to getTransactionCount -- funding them inside the later parallel step would have every
  // wallet's operator.sendTransaction race the same account's pending nonce.
  const privateKeys = Array.from({ length: COUNT }, () => generatePrivateKey());
  writeFileSync(KEYS_PATH, JSON.stringify(privateKeys, null, 2));
  console.log(`keys saved to ${KEYS_PATH} -- if this run dies, those wallets are not lost\n`);
  const accounts = privateKeys.map(privateKeyToAccount);
  const startNonce = await publicClient.getTransactionCount({
    address: operator.account.address,
    blockTag: "pending",
  });
  const fundHashes = await Promise.all(
    accounts.map((acc, i) =>
      operator.sendTransaction({
        to: acc.address,
        value: parseEther(FUND_MON),
        nonce: startNonce + i,
        // Declared, never estimated. A plain value transfer sent without an explicit gas limit
        // REVERTS on Monad -- the receipt says `reverted`, no funds move, and both RPCs agree
        // the transfer simply did not happen. Observed repeatedly: it is what made 5 of 6
        // wallets fail "funding never became visible" on two separate runs, which looks like
        // RPC read-lag and is not. Same undershooting-estimate failure documented for deposits.
        gas: 21_000n,
      }),
    ),
  );

  // Confirm each funding transfer actually SUCCEEDED. `waitForTransactionReceipt` resolves for
  // a reverted transaction too, so awaiting it without checking `status` is what let silent
  // funding failures surface much later as an unrelated-looking mint error.
  const fundReceipts = await Promise.all(
    fundHashes.map((h) => publicClient.waitForTransactionReceipt({ hash: h })),
  );
  const reverted = fundReceipts
    .map((r, i) => (r.status === "success" ? null : i))
    .filter((i) => i !== null);
  if (reverted.length > 0) {
    throw new Error(
      `funding reverted for wallet(s) ${reverted.join(", ")} -- keys are saved at ${KEYS_PATH}, ` +
        "top them up and re-run scripts/bet-storm-resume.mjs rather than generating new wallets",
    );
  }
  accounts.forEach((acc, i) => log(i, acc.address, `funded ${FUND_MON} MON`));

  const results = await Promise.allSettled(
    accounts.map((acc, i) => runWallet(i, acc, marketId, config)),
  );

  console.log("\n--- summary ---");
  let ok = 0;
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      ok++;
      console.log(`[${i}] OK   ${r.value.side.toUpperCase().padEnd(3)} ${r.value.address}`);
    } else {
      console.log(`[${i}] FAIL ${r.reason?.message ?? r.reason}`);
    }
  });
  console.log(`\n${ok}/${COUNT} placed a bet on market #${marketId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
