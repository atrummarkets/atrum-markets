/**
 * RPC endpoints for the browser.
 *
 * `NEXT_PUBLIC_RPC_URL` is meant to hold ONE endpoint -- the server-side `RPC_URL` is the one
 * that carries a comma-separated list. But the two names are one keystroke apart in a hosting
 * dashboard, and pasting the list into the public one would previously produce a single
 * unreachable URL and break every wallet read in the app with no obvious cause.
 *
 * So both forms are accepted here. A list gets split and used in preference order; a single URL
 * behaves exactly as before.
 */

const FALLBACK = "https://testnet-rpc.monad.xyz";

/** Endpoints from a raw env value, preference order preserved. Never empty. */
export function browserRpcUrls(raw: string | undefined = process.env.NEXT_PUBLIC_RPC_URL): string[] {
  const parsed = (raw ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : [FALLBACK];
}

/** The primary endpoint, for the places that genuinely need a single string. */
export function browserRpcUrl(raw?: string): string {
  return browserRpcUrls(raw)[0]!;
}
