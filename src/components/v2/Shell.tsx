"use client";

import Link from "next/link";
import EmblemMark from "@/components/atrum/logo/EmblemMark";
import LockupMark from "@/components/atrum/logo/LockupMark";
import { usePathname } from "next/navigation";
import { c, line, font } from "@/lib/atrum/v2/tokens";
import { useMarket } from "@/lib/atrum/marketContext";
import { useWallet } from "@/lib/atrum/wallet";
import { useDetailMode } from "@/lib/atrum/detailMode";

/**
 * The v2 chrome: header, nav, protocol toggle, footer.
 *
 * PROTOCOL ON/OFF is the mock's "two altitudes" made real, and it reuses v1's existing
 * `DetailModeProvider` rather than introducing a second notion of the same thing -- a user who
 * turns detail on should not find it off again after following a link into an older screen.
 *
 * The footer states what is true of this deployment and nothing more. The prototype's version
 * read "figures simulated locally, timings compressed", which was honest of a prototype and
 * would be a lie here: every number in v2 comes from chain or the API.
 */

const NAV = [
  { href: "/v2", label: "Markets" },
  { href: "/v2/portfolio", label: "Portfolio" },
  { href: "/v2/transfer", label: "Deposit / Withdraw" },
] as const;

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const connectBtn: React.CSSProperties = {
  background: "none",
  border: `1px solid ${line.strong}`,
  color: c.bright,
  fontFamily: font.mono,
  fontSize: 11,
  letterSpacing: "0.08em",
  padding: "6px 12px",
  borderRadius: 5,
  cursor: "pointer",
};

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { pool, clientProving } = useMarket();
  const { session, address, chainOk, connect, connecting, switchChain } = useWallet();
  const { mode, setMode } = useDetailMode();
  const detail = mode === "detailed";

  return (
    <div style={{ minHeight: "100vh", background: c.void, color: c.text, fontFamily: font.sans, display: "flex", flexDirection: "column" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 28,
          padding: "0 28px",
          height: 60,
          borderBottom: `1px solid ${line.faint}`,
          position: "sticky",
          top: 0,
          background: "rgba(11,12,14,0.92)",
          backdropFilter: "blur(12px)",
          zIndex: 40,
        }}
      >
        {/*
          The real brand marks, not a placeholder square. Both are inline SVG with
          `fill="currentColor"`, so the emblem takes the gold and the wordmark takes the ivory
          from `color` here rather than needing two recolored raster files.
        */}
        <Link href="/v2" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: c.text }}>
          <EmblemMark style={{ height: 18, width: 18 * (691 / 789), display: "block", color: c.gold }} />
          <LockupMark style={{ height: 13, width: 13 * (1154 / 357), display: "block" }} />
        </Link>

        <nav style={{ display: "flex", gap: 4, flex: 1 }}>
          {NAV.map((item) => {
            const active = item.href === "/v2" ? pathname === "/v2" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  fontSize: 13.5,
                  padding: "8px 14px",
                  borderRadius: 6,
                  color: active ? c.text : c.dim,
                  fontWeight: 500,
                  textDecoration: "none",
                  transition: "color .2s",
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            onClick={() => setMode(detail ? "simple" : "detailed")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: detail ? "rgba(200,164,101,0.08)" : "none",
              border: `1px solid ${detail ? line.gold : "rgba(255,255,255,0.1)"}`,
              cursor: "pointer",
              fontFamily: font.mono,
              fontSize: 11,
              letterSpacing: "0.08em",
              padding: "6px 12px",
              borderRadius: 5,
              color: detail ? c.gold : c.faint,
            }}
          >
            PROTOCOL {detail ? "ON" : "OFF"}
          </button>

          {/*
            Wrong chain is called out ahead of the address. A connected wallet on the wrong
            network fails every action with an error that names the transaction rather than the
            network, which is a bad way to learn you are on mainnet.
          */}
          {session && chainOk ? (
            <div style={{ fontFamily: font.mono, fontSize: 11, color: c.faint }}>{short(session)}</div>
          ) : address && !chainOk ? (
            <button onClick={switchChain} style={{ ...connectBtn, borderColor: "rgba(208,112,95,0.6)", color: c.red }}>
              SWITCH TO MONAD
            </button>
          ) : (
            <button onClick={connect} disabled={connecting} style={{ ...connectBtn, cursor: connecting ? "wait" : "pointer" }}>
              {connecting ? "CONNECTING…" : "CONNECT"}
            </button>
          )}
        </div>
      </header>

      {children}

      <footer
        style={{
          marginTop: "auto",
          padding: "16px 28px",
          borderTop: `1px solid ${line.faint}`,
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          fontFamily: font.mono,
          fontSize: 10.5,
          color: c.footer,
        }}
      >
        {/* Only claims this deployment can actually back. */}
        <span>
          MONAD TESTNET
          {pool ? ` · ANONYMITY SET ${pool.totalDeposits}` : ""}
          {clientProving ? " · PROVED IN YOUR BROWSER" : " · PROVED SERVER-SIDE"}
        </span>
        <Link href="/privacy" style={{ color: c.footer, textDecoration: "none" }}>
          WHAT IS AND IS NOT HIDDEN
        </Link>
      </footer>
    </div>
  );
}
