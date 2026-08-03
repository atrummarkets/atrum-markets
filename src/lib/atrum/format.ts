function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** "02d 11h 29m 33s" — deliberately explicit, never a relative "in 2 days". */
export function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return "closed";
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m` : `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
}

export function formatElapsed(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

export function formatBytes(bytes: number): string {
  return bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.round(bytes / 1e3)} kB`;
}

export function formatGas(gas: string | number): string {
  return Number(gas).toLocaleString("en-US");
}

export const shortHash = (h: string) => `${h.slice(0, 10)}…${h.slice(-8)}`;
export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export const EXPLORER = "https://testnet.monadexplorer.com";
export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const addressUrl = (address: string) => `${EXPLORER}/address/${address}`;
