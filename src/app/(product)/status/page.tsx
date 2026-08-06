"use client";

import { useCallback, useEffect, useState } from "react";
import { color, font } from "@/lib/atrum/theme";
import { useMarket } from "@/lib/atrum/marketContext";
import { useWallet } from "@/lib/atrum/wallet";

/**
 * Service status, and -- for the operator only -- the operations panel.
 *
 * ONE PAGE, TWO AUDIENCES. A user whose deposit has sat queued for ten minutes needs to know
 * whether the sequencer is up; that half is public and says only what is already readable
 * from the pool. The operator additionally needs the numbers that actually predict an outage,
 * and those are behind a session.
 *
 * WHY THE OPERATOR HALF EXISTS AT ALL. Every outage this deployment has had was a funding
 * problem diagnosed backwards: a relay account empties and the symptom is a user's bet failing
 * with "Signer had insufficient balance", naming neither the account nor the cause; the
 * batching account empties and deposits queue forever, looking like a hung sequencer. Both
 * have happened more than once. These are the numbers that should have been on a screen.
 *
 * Gated twice. This component refuses to render the operator half for anyone else, and
 * `/api/atrum/admin/health` independently requires an operator session. The component check is
 * presentation only -- a panel that declines to render is still one fetch away for anyone
 * reading the bundle -- so the route is the control that matters.
 */

interface PublicStatus {
  chain: string;
  sequencer: string;
  leaves: number | null;
  markets: { total: number; open: number };
  pool: {
    totalDeposits: number;
    minAnonymitySet: number;
    anonymityOk: boolean;
    queuedCount: number;
    batchCount: number;
  } | null;
  checkedAt: string;
}

interface Account {
  role: string;
  address: string;
  balance: string;
  low: boolean;
}

interface Health {
  healthy: boolean;
  problems: string[];
  accounts: Account[];
  dueOracleMarkets: { id: number; question: string }[];
}

const POLL_MS = 15000;

const panel: React.CSSProperties = {
  border: `1px solid ${color.hairline}`,
  padding: 20,
  marginBottom: 20,
};

const label: React.CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.16em",
  color: color.ash,
  marginBottom: 12,
};

function Dot({ ok }: { ok: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: 8,
        marginRight: 8,
        background: ok ? color.ivory : color.ember,
      }}
    />
  );
}

export default function StatusPage() {
  const { config } = useMarket();
  const { session } = useWallet();

  const [status, setStatus] = useState<PublicStatus | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sweeping, setSweeping] = useState(false);
  const [sweepResult, setSweepResult] = useState<string | null>(null);

  const isOperator =
    !!session && !!config?.operator && session.toLowerCase() === config.operator.toLowerCase();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/atrum/status");
      if (!res.ok) throw new Error(`status -> ${res.status}`);
      setStatus(await res.json());
      setError(null);
    } catch (e) {
      // Keep the last good reading. A blank panel during a blip reads as "everything is down",
      // which is the one thing a status page must never say by accident.
      setError((e as Error).message);
    }

    if (!isOperator) {
      setHealth(null);
      return;
    }
    try {
      const res = await fetch("/api/atrum/admin/health");
      if (res.ok) setHealth(await res.json());
    } catch {
      // The public half still rendered; the operator half simply stays stale.
    }
  }, [isOperator]);

  useEffect(() => {
    // Deferred by a tick rather than called inline: `load` sets state, and a state update
    // dispatched synchronously from an effect body forces an extra render pass before paint.
    const first = setTimeout(load, 0);
    const id = setInterval(load, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [load]);

  const sweep = async () => {
    setSweeping(true);
    setSweepResult(null);
    try {
      const res = await fetch("/api/atrum/cron/resolve", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "sweep failed");
      setSweepResult(
        body.acted === 0
          ? `Nothing due (${body.checked} checked).`
          : `${body.acted} market(s) actioned, ${body.failed} failed.`,
      );
      load();
    } catch (e) {
      setSweepResult((e as Error).message);
    } finally {
      setSweeping(false);
    }
  };

  const chainOk = status?.chain === "ok";
  const seqOk = status?.sequencer === "ok";

  return (
    <main style={{ padding: 48, maxWidth: 860, margin: "0 auto", fontFamily: font.body }}>
      <h1 style={{ fontSize: 28, marginBottom: 8, color: color.ivory }}>Status</h1>
      <p style={{ color: color.smoke, fontSize: 14, marginBottom: 32 }}>
        Live, refreshed every {POLL_MS / 1000}s.
        {status && (
          <span style={{ color: color.ash }}> Last checked {new Date(status.checkedAt).toLocaleTimeString()}.</span>
        )}
      </p>

      {error && !status && (
        <div style={{ ...panel, borderColor: color.ember, color: color.ember }}>
          Could not reach the status endpoint: {error}
        </div>
      )}

      {status && (
        <>
          <div style={panel}>
            <div style={label}>Services</div>
            <div style={{ fontSize: 15, color: color.bone, lineHeight: 2 }}>
              <div>
                <Dot ok={chainOk} />
                Monad testnet — {chainOk ? "reachable" : "unreachable"}
              </div>
              <div>
                <Dot ok={seqOk} />
                Sequencer — {seqOk ? `up, ${status.leaves?.toLocaleString()} leaves in the tree` : "unreachable"}
              </div>
            </div>
            {!seqOk && (
              <p style={{ fontSize: 13, color: color.ash, marginTop: 12, marginBottom: 0 }}>
                Deposits will queue but not graft until this recovers. Nothing is lost — a note
                joins the next batch once it is back.
              </p>
            )}
          </div>

          {status.pool && (
            <div style={panel}>
              <div style={label}>Pool</div>
              <div style={{ fontSize: 15, color: color.bone, lineHeight: 2 }}>
                <div>
                  <Dot ok={status.pool.anonymityOk} />
                  Anonymity set — {status.pool.totalDeposits} deposits, floor is {status.pool.minAnonymitySet}
                </div>
                <div style={{ paddingLeft: 16 }}>
                  {status.pool.queuedCount} queued · {status.pool.batchCount} batches grafted
                </div>
                <div style={{ paddingLeft: 16 }}>
                  {status.markets.open} of {status.markets.total} markets open for betting
                </div>
              </div>
              {!status.pool.anonymityOk && (
                <p style={{ fontSize: 13, color: color.ash, marginTop: 12, marginBottom: 0 }}>
                  Below the floor, actions are refused by the contract on purpose — a bet placed
                  into a crowd this small would not be private. It clears as deposits arrive.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {isOperator && health && (
        <>
          <h2 style={{ fontSize: 20, margin: "40px 0 8px", color: color.ivory }}>Operations</h2>
          <p style={{ color: color.ash, fontSize: 13, marginBottom: 20 }}>
            Visible because this wallet is the operator.
          </p>

          <div style={{ ...panel, borderColor: health.healthy ? color.hairline : color.ember }}>
            <div style={label}>Checks</div>
            {health.healthy ? (
              <div style={{ color: color.ivory }}>
                All accounts funded, sequencer reachable, nothing overdue.
              </div>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18, color: color.ember }}>
                {health.problems.map((p) => (
                  <li key={p} style={{ marginBottom: 6 }}>
                    {p}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={panel}>
            <div style={label}>Accounts</div>
            {health.accounts.map((a) => (
              <div
                key={a.address}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: "8px 0",
                  borderBottom: `1px solid ${color.hairline}`,
                  fontSize: 14,
                }}
              >
                <span style={{ color: color.bone, minWidth: 170 }}>{a.role}</span>
                <span style={{ fontFamily: font.mono, fontSize: 12, color: color.smoke, flex: 1 }}>
                  {a.address}
                </span>
                <span style={{ fontFamily: font.mono, color: a.low ? color.ember : color.ivory }}>
                  {a.balance}
                </span>
              </div>
            ))}
            <p style={{ fontSize: 12, color: color.ash, marginTop: 12, marginBottom: 0 }}>
              A relayed action costs ~0.5 MON and a batch ~0.41 MON, billed at the declared gas
              limit whether used or not. Top up with{" "}
              <code style={{ fontFamily: font.mono }}>scripts/autofund.mjs</code>.
            </p>
          </div>

          <div style={panel}>
            <div style={label}>Oracle markets awaiting resolution</div>
            {health.dueOracleMarkets.length === 0 ? (
              <div style={{ color: color.smoke, fontSize: 14, marginBottom: 12 }}>None due.</div>
            ) : (
              <ul style={{ margin: "0 0 12px", paddingLeft: 18, color: color.bone, fontSize: 14 }}>
                {health.dueOracleMarkets.map((m) => (
                  <li key={m.id} style={{ marginBottom: 4 }}>
                    #{m.id} — {m.question}
                  </li>
                ))}
              </ul>
            )}
            <button
              onClick={sweep}
              disabled={sweeping}
              style={{
                padding: "10px 20px",
                border: `1px solid ${color.hairlineStrong}`,
                background: "none",
                color: color.bone,
                borderRadius: 2,
                cursor: sweeping ? "wait" : "pointer",
                fontSize: 13,
              }}
            >
              {sweeping ? "Sweeping…" : "Resolve & settle due markets now"}
            </button>
            {sweepResult && <div style={{ marginTop: 12, fontSize: 13, color: color.smoke }}>{sweepResult}</div>}
            <p style={{ fontSize: 12, color: color.ash, marginTop: 12, marginBottom: 0 }}>
              Runs automatically wherever a scheduler calls{" "}
              <code style={{ fontFamily: font.mono }}>/api/atrum/cron/resolve</code>. This button is
              the same sweep, by hand.
            </p>
          </div>
        </>
      )}
    </main>
  );
}
