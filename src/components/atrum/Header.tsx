"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { color, font, motion } from "@/lib/atrum/theme";
import { useMarket } from "@/lib/atrum/marketContext";
import { useWallet } from "@/lib/atrum/wallet";
import Logo from "./Logo";

const NAV = [
  { href: "/start", label: "Start" },
  { href: "/markets", label: "Markets" },
  { href: "/notes", label: "Notes" },
  { href: "/boundary", label: "Boundary" },
] as const;

function navLinkStyle(active: boolean) {
  return {
    padding: "6px 0",
    fontSize: 11,
    textTransform: "uppercase" as const,
    letterSpacing: "0.16em",
    color: active ? color.ivory : color.smoke,
    borderBottom: `1px solid ${active ? color.ivory : "transparent"}`,
    transition: `color ${motion.control}`,
  };
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default function Header() {
  const pathname = usePathname();
  const { pool } = useMarket();
  const { address, session, chainOk, connecting, connect, disconnect, switchChain, hasProvider } = useWallet();

  const ok = pool ? pool.anonymityOk : false;

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        gap: 48,
        height: 64,
        padding: "0 32px",
        background: color.void,
        borderBottom: `1px solid ${color.hairline}`,
      }}
    >
      <Logo href="/markets" size={22} />

      <nav style={{ display: "flex", gap: 32 }}>
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} style={navLinkStyle(pathname.startsWith(item.href))}>
            {item.label}
          </Link>
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      {pool && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash }}>
            Anonymity set
          </span>
          <span style={{ fontFamily: font.mono, fontSize: 20, color: ok ? color.ivory : color.ember }}>
            {String(pool.totalDeposits).padStart(2, "0")}
          </span>
          <span style={{ fontSize: 13, color: color.pewter }}>/ {pool.minAnonymitySet} floor</span>
          <div style={{ width: 1, height: 16, background: color.slate }} />
        </div>
      )}

      {!hasProvider ? (
        <a
          href="https://metamask.io/download/"
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 13, color: color.pewter, textDecoration: "none", border: `1px solid ${color.hairline}`, padding: "8px 16px", borderRadius: 2 }}
        >
          Install a wallet
        </a>
      ) : !session ? (
        <button
          onClick={connect}
          disabled={connecting}
          style={{
            padding: "10px 20px",
            border: `1px solid ${color.hairlineStrong}`,
            background: "none",
            color: color.bone,
            borderRadius: 2,
            cursor: connecting ? "wait" : "pointer",
            fontSize: 13,
            letterSpacing: "0.04em",
          }}
        >
          {connecting ? "Connecting…" : "Connect wallet"}
        </button>
      ) : !chainOk ? (
        <button
          onClick={switchChain}
          style={{ padding: "10px 20px", border: `1px solid ${color.ember}`, background: "none", color: color.ember, borderRadius: 2, cursor: "pointer", fontSize: 13 }}
        >
          Switch to Monad testnet
        </button>
      ) : (
        <button
          onClick={disconnect}
          title={address ?? undefined}
          style={{
            padding: "10px 20px",
            border: `1px solid ${color.hairline}`,
            background: "none",
            color: color.pewter,
            borderRadius: 2,
            cursor: "pointer",
            fontFamily: font.mono,
            fontSize: 13,
          }}
        >
          {short(session)}
        </button>
      )}
    </header>
  );
}
