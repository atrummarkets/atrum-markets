function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** "02d 11h 29m 33s" — deliberately explicit, never a relative "in 2 days". */
export function formatCountdown(totalSeconds: number): string {
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${pad(d)}d ${pad(h)}h ${pad(m)}m ${pad(s)}s`;
}

export function formatElapsed(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}
