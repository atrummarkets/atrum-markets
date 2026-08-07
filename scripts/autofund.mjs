/**
 * Top up the accounts that keep this deployment running, from whichever of them has spare.
 *
 * WHY THIS EXISTS. Three account roles drain during ordinary use and each fails in a way that
 * does not name itself:
 *
 *   - relay accounts   ~0.5 MON per user action (ACTION_GAS_LIMIT is billed in full whether
 *                      used or not). Empty => every bet and redemption fails with
 *                      "Signer had insufficient balance", naming no account.
 *   - batching account ~0.41 MON per flushBatch. Empty => deposits queue forever and it looks
 *                      like the sequencer has hung.
 *   - operator         resolve, settle, market creation, and funding everything else.
 *
 * All three have run dry on this deployment, each diagnosed backwards from a broken user
 * action. This makes the fix one command instead of an investigation.
 *
 * EXPLICIT GAS ON EVERY TRANSFER, AND THAT IS NOT A DETAIL. A plain value transfer sent
 * without a declared gas limit reverts on Monad -- observed repeatedly: the receipt says
 * `reverted`, no funds move, and both RPCs agree the transfer simply did not happen. It is the
 * same undershooting-estimate failure `marketContext.tsx` documents for deposits, which is why
 * every send here declares 21,000.
 *
 * Usage:
 *   FUNDER_KEY=0x... node --env-file=.env.local scripts/autofund.mjs [--dry-run]
 *
 * Env:
 *   FUNDER_KEY    the key funds come FROM. Defaults to PRIVATE_KEY (the operator).
 *   RPC_URL, POOL_ADDRESS, SEQUENCER_URL  as the app uses them.
 */
import { createPublicClient, createWalletClient, http, defineChain, parseEther, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const DRY_RUN = process.argv.includes("--dry-run");

const RPC_URL = process.env.RPC_URL ?? "https://rpc.ankr.com/monad_testnet";
const POOL_ADDRESS = process.env.POOL_ADDRESS;
const SEQUENCER_URL = process.env.SEQUENCER_URL;
const funderKey = process.env.FUNDER_KEY ?? process.env.PRIVATE_KEY;

if (!funderKey) {
  console.error("error: set FUNDER_KEY (or PRIVATE_KEY) to the account funds come from");
  process.exit(1);
}
if (!POOL_ADDRESS) {
  console.error("error: missing POOL_ADDRESS");
  process.exit(1);
}

/**
 * Targets: top up to `target` whenever below `floor`.
 *
 * Two levels rather than one so a run does not send dust. Topping up to exactly the floor
 * would mean the next single action drops it below again and the following run sends another
 * transfer, forever.
 */
const RELAYER_FLOOR = parseEther("1");
const RELAYER_TARGET = parseEther("3");
const BATCHER_FLOOR = parseEther("2");
const BATCHER_TARGET = parseEther("5");

/** Never spend the funder below this -- it still has to pay for resolve, settle and creation. */
const FUNDER_RESERVE = parseEther("1");

const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

const publicClient = createPublicClient({ chain: monadTestnet, transport: http() });
const funder = privateKeyToAccount(funderKey);
const wallet = createWalletClient({ chain: monadTestnet, transport: http(), account: funder });

const mon = (wei) => `${Number(formatEther(wei)).toFixed(3)} MON`;

async function collectTargets() {
  const targets = [];

  // The batching account is whatever the pool says it is. Reading it from chain rather than
  // from config means this cannot drift from the address `onlySequencer` actually authorises.
  const batcher = await publicClient.readContract({
    address: POOL_ADDRESS,
    abi: [{ name: "sequencer", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] }],
    functionName: "sequencer",
  });
  targets.push({ role: "batcher", address: batcher, floor: BATCHER_FLOOR, target: BATCHER_TARGET });

  if (SEQUENCER_URL) {
    try {
      const res = await fetch(`${SEQUENCER_URL}/relayers`);
      if (res.ok) {
        const body = await res.json();
        if (!body.relaying) console.warn("warning: relaying is DISABLED on the sequencer");
        body.accounts.forEach((a, i) =>
          targets.push({ role: `relayer ${i}`, address: a.address, floor: RELAYER_FLOOR, target: RELAYER_TARGET }),
        );
      } else {
        console.warn(`warning: ${SEQUENCER_URL}/relayers -> ${res.status}; relayers not checked`);
      }
    } catch (error) {
      console.warn(`warning: could not reach the sequencer: ${error.message}`);
    }
  } else {
    console.warn("warning: SEQUENCER_URL unset -- relayer accounts will not be checked");
  }

  return targets;
}

const targets = await collectTargets();

console.log(`funder ${funder.address}: ${mon(await publicClient.getBalance({ address: funder.address }))}\n`);

const needy = [];
for (const t of targets) {
  const balance = await publicClient.getBalance({ address: t.address });
  const short = balance < t.floor ? t.target - balance : 0n;
  console.log(`  ${t.role.padEnd(12)} ${t.address}  ${mon(balance).padStart(10)}${short > 0n ? `  -> needs ${mon(short)}` : ""}`);
  if (short > 0n) needy.push({ ...t, balance, short });
}

if (needy.length === 0) {
  console.log("\nnothing to do -- every account is above its floor");
  process.exit(0);
}

const total = needy.reduce((sum, t) => sum + t.short, 0n);
const available = (await publicClient.getBalance({ address: funder.address })) - FUNDER_RESERVE;

console.log(`\n${needy.length} account(s) need ${mon(total)}; funder can spare ${mon(available)}`);

if (available < total) {
  // Refuse rather than partially fund in an arbitrary order. A half-funded relayer set fails
  // the same way a fully empty one does, and the operator should know the pot is short.
  console.error(
    `\nerror: funder is short by ${mon(total - available)}. Top it up, or lower the targets.\n` +
      "       Refusing to partially fund -- a partly-funded relayer set still fails user actions.",
  );
  process.exit(1);
}

if (DRY_RUN) {
  console.log("\n(dry run -- nothing sent)");
  process.exit(0);
}

console.log("");
let nonce = await publicClient.getTransactionCount({ address: funder.address, blockTag: "pending" });

for (const t of needy) {
  const hash = await wallet.sendTransaction({
    to: t.address,
    value: t.short,
    nonce: nonce++,
    // See the header: without this, the transfer reverts on Monad and no funds move.
    gas: 21_000n,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const after = await publicClient.getBalance({ address: t.address });
  console.log(
    `  ${t.role.padEnd(12)} ${receipt.status === "success" ? "sent" : "FAILED"} ${mon(t.short)} -> ${mon(after)}  ${hash}`,
  );
  if (receipt.status !== "success") process.exitCode = 1;
}
