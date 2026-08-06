"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { color } from "@/lib/atrum/theme";
import { doResolve, doSettle, type LiveMarket } from "@/lib/atrum/api";
import { useMarket } from "@/lib/atrum/marketContext";
import { useWallet } from "@/lib/atrum/wallet";
import { txUrl, shortHash } from "@/lib/atrum/format";
import Panel from "@/components/atrum/ui/Panel";
import Label from "@/components/atrum/ui/Label";
import StatRow from "@/components/atrum/ui/StatRow";
import PillButton from "@/components/atrum/ui/PillButton";

/**
 * Operator controls for a manually-resolved market.
 *
 * Shown only once the market is actually resolvable, and labelled for what it is: these
 * markets name an EOA as `Vault.resolver`, so a person decides the outcome. Production markets
 * point `resolver` at `PythResolver`, where the outcome is a comparison against a signed price
 * and no address can decide it. Hiding this panel would not make the market trustless; saying
 * so is the honest option. A solid border + "OPERATOR" chip (not a dashed border, which read as
 * an unfinished/debug leftover) marks it as a real, sanctioned control instead.
 *
 * Also hidden from anyone who is not the operator. That is presentation only -- the real check
 * is `requireOperator` on the routes, because a panel this component declines to render is
 * still two `fetch` calls away for anyone who reads the bundle.
 */
export default function AdminPanel({ market, now }: { market: LiveMarket; now: number }) {
  const { refresh, config } = useMarket();
  const { session } = useWallet();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; hash?: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const isOperator =
    !!session && !!config?.operator && session.toLowerCase() === config.operator.toLowerCase();

  const resolvable = market.phase === "closed" && now >= market.resolutionStartTime;
  const settleable = market.phase === "resolved";
  if (!isOperator) return null;
  if (!resolvable && !settleable) return null;

  async function act(what: string, fn: () => Promise<{ txHash: string }>) {
    setBusy(what);
    setErr(null);
    setMsg(null);
    try {
      const r = await fn();
      setMsg({ text: `${what} done`, hash: r.txHash || undefined });
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.44, ease: [0.16, 1, 0.3, 1] }}
      style={{ marginTop: 56 }}
    >
      <Panel padding="p-7" className="border-hairlineStrong">
        <div className="mb-3 flex items-center gap-3">
          <Label className="border border-hairlineStrong px-2 py-1 text-halo">Operator</Label>
          <Label>Manual resolver</Label>
        </div>
        <p style={{ margin: "0 0 20px", fontSize: 14, color: color.smoke, maxWidth: "70ch" }}>
          This market names an address as its resolver, so a person decides the outcome and it is visible here
          rather than hidden. Oracle-resolved markets replace this with a signed price comparison that nobody can
          override.
        </p>

        <div className="flex flex-wrap gap-2">
          {resolvable && (
            <PillButton
              selected={false}
              disabled={busy !== null}
              onClick={() => act("Resolve YES", () => doResolve(market.marketId, "YES"))}
              unselectedClassName="bg-transparent text-bone border-hairlineStrong"
              className="px-5 py-3"
            >
              {busy === "Resolve YES" ? "Working…" : "Resolve YES"}
            </PillButton>
          )}
          {resolvable && (
            <PillButton
              selected={false}
              disabled={busy !== null}
              onClick={() => act("Resolve NO", () => doResolve(market.marketId, "NO"))}
              unselectedClassName="bg-transparent text-bone border-hairlineStrong"
              className="px-5 py-3"
            >
              {busy === "Resolve NO" ? "Working…" : "Resolve NO"}
            </PillButton>
          )}
          {settleable && (
            <PillButton
              selected={false}
              disabled={busy !== null}
              onClick={() => act("Settle", () => doSettle(market.marketId))}
              unselectedClassName="bg-transparent text-halo border-halo"
              className="px-5 py-3"
            >
              {busy === "Settle" ? "Working…" : "Settle (decrypt + publish totals)"}
            </PillButton>
          )}
        </div>

        {msg && (
          <div className="mt-4">
            <StatRow label={msg.text}>
              {msg.hash ? (
                <a href={txUrl(msg.hash)} target="_blank" rel="noreferrer" className="text-halo">
                  {shortHash(msg.hash)}
                </a>
              ) : (
                "—"
              )}
            </StatRow>
          </div>
        )}
        {err && <p style={{ margin: "16px 0 0", fontSize: 13, color: color.ember }}>{err}</p>}
      </Panel>
    </motion.div>
  );
}
