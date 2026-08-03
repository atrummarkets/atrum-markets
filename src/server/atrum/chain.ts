import { createPublicClient, createWalletClient, http, parseAbi, getAddress, defineChain } from "viem";
import type { Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { join } from "node:path";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing required env var ${name}`);
  return v;
}

export const CHAIN_ID = 10143;

export const monadTestnet = defineChain({
  id: CHAIN_ID,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [env("RPC_URL")] } },
});

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

/** The public RPC the BROWSER should use. Never the private one -- it carries an API key. */
export const PUBLIC_RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://testnet-rpc.monad.xyz";

/**
 * The operator key. Used ONLY for admin work the protocol gives to a named role -- resolving a
 * market and publishing its settled totals. User actions never touch it: `deposit` is signed by
 * the user's own wallet, and bet/redeem/withdraw go out through the sequencer's relayer.
 */
const account = privateKeyToAccount(env("PRIVATE_KEY") as `0x${string}`);
export const operatorAddress: Address = account.address;

export const publicClient = createPublicClient({ chain: monadTestnet, transport: http() });
export const walletClient = createWalletClient({ chain: monadTestnet, transport: http(), account });

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
