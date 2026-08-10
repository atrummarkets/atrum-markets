import { createPublicClient, createWalletClient, http, fallback, parseAbi, getAddress, defineChain } from "viem";
import type { Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { join } from "node:path";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing required env var ${name}`);
  return v;
}

export const CHAIN_ID = 10143;

/**
 * RPC endpoints, highest preference first.
 *
 * `RPC_URL` takes a comma-separated list. A single URL still works, so nothing that already
 * sets one break.
 *
 * WHY A LIST. Every read in this app is a plain `eth_call` against a public endpoint, and
 * public endpoints rate-limit. One `/api/atrum/markets` fans out across every market in the
 * registry, so a single provider running out of quota takes the whole product down with a 500 --
 * which is exactly what happened on Ankr's free tier. Rotating means one exhausted provider
 * costs a retry rather than an outage.
 */
const RPC_URLS = env("RPC_URL")
  .split(",")
  .map((u) => u.trim())
  .filter(Boolean);

export const monadTestnet = defineChain({
  id: CHAIN_ID,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: RPC_URLS } },
  // Canonical Multicall3, verified deployed at this address on Monad testnet. Its presence is
  // what lets `batch: { multicall: true }` below collapse a fan-out into one request.
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
});

/**
 * Rotating transport.
 *
 * `rank` re-orders the endpoints by observed latency and success, so a provider that starts
 * failing is demoted automatically instead of being retried at the front of the queue forever.
 */
function rotating() {
  return fallback(
    RPC_URLS.map((url) => http(url, { retryCount: 2, retryDelay: 300, timeout: 10_000 })),
    { rank: RPC_URLS.length > 1 ? { interval: 30_000, sampleCount: 3 } : false },
  );
}

export const POOL_ADDRESS = getAddress(env("POOL_ADDRESS"));
export const COLLATERAL_ADDRESS = getAddress(env("COLLATERAL_ADDRESS"));
export const SEQUENCER_URL = env("SEQUENCER_URL");

/**
 * Where this app's compiled circuit artifacts live -- committed to this repo at
 * circuits-build/ (see scripts/sync-circuits.mjs), not a sibling atrum-core checkout.
 * A mismatch between these artifacts and the live pool's deployed verifiers fails as
 * InvalidProof() with no other diagnostic, so keep circuits-build/ in sync with whichever
 * atrum-core tree the pool was actually deployed from.
 */
export const CIRCUITS_DIR = process.env.CIRCUITS_DIR ?? join(process.cwd(), "circuits-build");

/**
 * The public RPC the BROWSER should use. Kept separate from the server list above.
 *
 * Reduced to a single endpoint even if a list was configured: this value is published through
 * `/api/atrum/config` and displayed, and a comma-joined string shown as "the RPC" is confusing
 * at best and copy-pasted into a wallet at worst.
 */
export const PUBLIC_RPC_URL = (process.env.NEXT_PUBLIC_RPC_URL ?? "https://testnet-rpc.monad.xyz")
  .split(",")[0]!
  .trim();

/**
 * The operator key. Used ONLY for admin work the protocol gives to a named role -- resolving a
 * market and publishing its settled totals. User actions never touch it: `deposit` is signed by
 * the user's own wallet, and bet/redeem/withdraw go out through the sequencer's relayer.
 */
const account = privateKeyToAccount(env("PRIVATE_KEY") as `0x${string}`);
export const operatorAddress: Address = account.address;

/**
 * Wallets allowed through `requireOperator()`, beyond the signer above.
 *
 * Granting operator ACCESS (viewing analytics/health, triggering resolve/settle) is a
 * different thing from holding the signing KEY: every admin write still executes with
 * `account` above regardless of which browser session triggered it, so adding a wallet here
 * never hands out `PRIVATE_KEY` -- it only lets that wallet's session pass the auth check.
 *
 * `EXTRA_OPERATOR_ADDRESSES` is optional and comma-separated, same convention as `RPC_URL`.
 */
const extraOperators = (process.env.EXTRA_OPERATOR_ADDRESSES ?? "")
  .split(",")
  .map((a) => a.trim())
  .filter(Boolean)
  .map((a) => getAddress(a));

export const operatorAddresses: Address[] = [account.address, ...extraOperators];

export function isOperatorAddress(address: string): boolean {
  const lower = address.toLowerCase();
  return operatorAddresses.some((a) => a.toLowerCase() === lower);
}

/**
 * `batch: { multicall: true }` is the actual fix for the rate limiting, not the rotation.
 *
 * Reading the market list issued one `eth_call` per field per market -- 113 requests for an
 * 18-market registry, every poll, per open tab. Batching coalesces the concurrent ones into a
 * single `Multicall3.aggregate3` call, so the same page load costs a couple of requests instead
 * of a hundred. Rotation then covers the case where a provider is unhealthy for other reasons.
 */
export const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: rotating(),
  batch: { multicall: { wait: 12 } },
});
export const walletClient = createWalletClient({ chain: monadTestnet, transport: rotating(), account });

export const POOL_ABI = parseAbi([
  "function deposit(uint256[2] pA, uint256[2][2] pB, uint256[2] pC, uint256 commitment, uint256 units)",
  "function betEncrypted(uint256[2] pA, uint256[2][2] pB, uint256[2] pC, uint256 root, uint256 nullifierHash, uint256 newCommitment, uint256 betMeta, uint256[4] ciphertext)",
  "function redeemPrivate(uint256[2] pA, uint256[2][2] pB, uint256[2] pC, uint256 root, uint256 nullifierHash, uint256 newCommitment, uint256 redeemMeta)",
  "function withdraw(uint256[2] pA, uint256[2][2] pB, uint256[2] pC, uint256 root, uint256 nullifierHash, uint256 changeCommitment, uint256 withdrawData)",
  "function totalDeposits() view returns (uint256)",
  "function minAnonymitySet() view returns (uint256)",
  "function denomination() view returns (uint256)",
  "function queuedCount() view returns (uint256)",
  "function batchCount() view returns (uint256)",
  "function marketVault(uint32) view returns (address)",
  "function encryptedMarket(uint32) view returns (bool)",
  "function encryptedTotals() view returns (address)",
  "function depositsAtDenomination(uint256) view returns (uint256)",
  "error AnonymitySetTooSmall(uint256 have, uint256 need)",
  "error DenominationTooRare(uint256 amount, uint256 have, uint256 need)",
  "error RootTooRecent(uint256 age, uint256 need)",
  "error UnknownRoot()",
  "error NullifierAlreadySpent()",
  "error BettingClosed()",
  "error NotSettled2()",
  "error NotResolved()",
  "error MarketNotRegistered()",
  "error WrongActionForMarket()",
  "error NotADenomination(uint256 amount)",
  "error LosingOrSettledPosition()",
  "error TotalsMismatch()",
  "error PoolInsolvent()",
  "error InvalidProof()",
]);

export const VAULT_ABI = parseAbi([
  "function outcome() view returns (uint8)",
  "function resolve(uint8 outcome_)",
  "function bettingCloseTime() view returns (uint64)",
  "function resolutionStartTime() view returns (uint64)",
]);

export const TOTALS_ABI = parseAbi([
  "function accumulator() view returns (address)",
  "function settled(uint32) view returns (bool)",
  "function finalYesTotal(uint32) view returns (uint256)",
  "function finalNoTotal(uint32) view returns (uint256)",
  "function publishFinalTotals(uint32 marketId, uint256 yesTotal, uint256 noTotal, (uint256 dx, uint256 dy, (uint256 ax, uint256 ay, uint256 bx, uint256 by, uint256 z) proof) yes, (uint256 dx, uint256 dy, (uint256 ax, uint256 ay, uint256 bx, uint256 by, uint256 z) proof) no)",
]);

export const ACCUMULATOR_ABI = parseAbi([
  "function totalAffine(uint32 marketId, uint8 outcome) view returns (uint256 c1x, uint256 c1y, uint256 c2x, uint256 c2y)",
]);

export const ERC20_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function mint(address,uint256)",
  "function decimals() view returns (uint8)",
]);

export const OUTCOME_YES = 1;
export const OUTCOME_NO = 2;
