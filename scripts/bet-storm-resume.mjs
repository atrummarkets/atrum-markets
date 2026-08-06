/**
 * One-off resume: bet-storm.mjs's own funding step crashed via Promise.all rejecting on an
 * RPC timeout (rejects the whole batch even though other sendTransaction calls were already
 * in flight). All 6 wallets are now funded (some by the original run, some by a manual
 * top-up). This reuses the exact keys already saved in bet-storm-keys.json and re-runs only
 * the mint/signin/deposit/graft/bet sequence -- same logic as runWallet() in bet-storm.mjs.
 *
 * Usage: PRIVATE_KEY=0x... node scripts/bet-storm-resume.mjs <marketId> [units]
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  defineChain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const KEYS_PATH = join(dirname(fileURLToPath(import.meta.url)), "bet-storm-keys.json");
const MARKET_ID = Number(process.argv[2]);
const UNITS = BigInt(process.argv[3] ?? 100);
if (!Number.isFinite(MARKET_ID)) {
  console.error("usage: node scripts/bet-storm-resume.mjs <marketId> [units]");
  process.exit(1);
}

const RPC_URL = process.env.RPC_URL ?? "https://rpc.ankr.com/monad_testnet";
const BASE_URL = process.env.BASE_URL ?? "https://markets.atrum.fun";

const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

const publicClient = createPublicClient({ chain: monadTestnet, transport: http() });

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

async function runWallet(i, account, marketId, config) {
  const wallet = createWalletClient({ chain: monadTestnet, transport: http(), account });
  const addr = account.address;

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

  const { body: n } = await api("/api/atrum/auth/nonce", null);
  const signature = await wallet.signMessage({ message: n.message });
  const { cookie } = await api("/api/atrum/auth/verify", null, {
    method: "POST",
    body: JSON.stringify({ address: addr, nonce: n.nonce, signature }),
  });
  log(i, addr, "signed in");

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
  const privateKeys = JSON.parse(readFileSync(KEYS_PATH, "utf8"));
  const accounts = privateKeys.map(privateKeyToAccount);

  console.log(`\nresuming ${accounts.length} wallets, ${UNITS} units each, market #${MARKET_ID}, base ${BASE_URL}\n`);

  const results = await Promise.allSettled(
    accounts.map((acc, i) => runWallet(i, acc, MARKET_ID, config)),
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
  console.log(`\n${ok}/${accounts.length} placed a bet on market #${MARKET_ID}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
