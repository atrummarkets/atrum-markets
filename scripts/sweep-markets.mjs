/**
 * Resolve and settle every oracle market that is due.
 *
 * WHY THIS EXISTS SEPARATELY FROM THE ENDPOINT. `/api/atrum/cron/resolve` does the work, but
 * something has to call it. Vercel Cron is capped at once per day on Hobby -- useless for a
 * twenty-minute market -- and setting `CRON_SECRET` needs a dashboard this team does not all
 * have. So this authenticates the other way the route already allows: as the operator, with a
 * signature, exactly as a browser would.
 *
 * Nothing here needs hosting configuration. A GitHub Action runs it on a schedule with the
 * operator key as a repo secret (.github/workflows/sweep-markets.yml), and it runs identically
 * on a laptop during a demo.
 *
 * Idempotent, because the endpoint is: it re-reads each market's on-chain `outcome()` and
 * `settled` before acting, so calling it every five minutes costs a few RPC reads and does
 * nothing else. Safe to run far more often than markets actually resolve.
 *
 * Usage:
 *   OPERATOR_PRIVATE_KEY=0x... BASE_URL=https://markets.atrum.fun node scripts/sweep-markets.mjs
 */
import { privateKeyToAccount } from "viem/accounts";

const BASE_URL = (process.env.BASE_URL ?? "https://markets.atrum.fun").replace(/\/$/, "");
const key = process.env.OPERATOR_PRIVATE_KEY ?? process.env.PRIVATE_KEY;

if (!key) {
  console.error("error: set OPERATOR_PRIVATE_KEY (the address the markets name as resolver)");
  process.exit(1);
}

const account = privateKeyToAccount(key.startsWith("0x") ? key : `0x${key}`);

/**
 * Sign in the way the browser does: server-issued single-use nonce, personal_sign, cookie.
 * The route accepts an operator session as an alternative to CRON_SECRET, which is what lets
 * this work without touching hosting config.
 */
async function signIn() {
  const nonceRes = await fetch(`${BASE_URL}/api/atrum/auth/nonce`);
  if (!nonceRes.ok) throw new Error(`auth/nonce -> ${nonceRes.status}`);
  const { nonce, message } = await nonceRes.json();

  const signature = await account.signMessage({ message });

  const verifyRes = await fetch(`${BASE_URL}/api/atrum/auth/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address: account.address, nonce, signature }),
  });
  if (!verifyRes.ok) {
    throw new Error(`auth/verify -> ${verifyRes.status}: ${JSON.stringify(await verifyRes.json())}`);
  }

  const cookie = verifyRes.headers
    .getSetCookie()
    .find((c) => c.startsWith("atrum_session="))
    ?.split(";")[0];
  if (!cookie) throw new Error("no session cookie returned");
  return cookie;
}

console.log(`sweeping ${BASE_URL} as ${account.address}`);

const cookie = await signIn();

const res = await fetch(`${BASE_URL}/api/atrum/cron/resolve`, {
  method: "POST",
  headers: { cookie },
});
const body = await res.json().catch(() => ({}));

if (!res.ok) {
  // 403 here almost always means this key is not the operator the deployment expects, which is
  // worth saying plainly rather than leaving as a bare status code in a CI log.
  console.error(
    `sweep failed (${res.status}): ${body.error ?? "unknown"}` +
      (res.status === 403 ? `\n  ${account.address} is not the operator this deployment authorises` : ""),
  );
  process.exit(1);
}

console.log(`checked ${body.checked}, acted ${body.acted}, skipped ${body.skipped}, failed ${body.failed}`);
for (const r of body.results ?? []) {
  console.log(`  #${r.marketId} ${r.action}: ${r.detail}`);
  if (r.resolveTx) console.log(`      resolve ${r.resolveTx}`);
  if (r.settleTx) console.log(`      settle  ${r.settleTx}`);
}

// A market that could not be resolved is worth failing the run for -- a red X is how anyone
// finds out. Doing nothing because nothing was due is a success, not a silence to worry about.
if (body.failed > 0) process.exit(1);
