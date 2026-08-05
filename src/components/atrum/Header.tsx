"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { color, font, motion as motionTokens } from "@/lib/atrum/theme";
import { useMarket } from "@/lib/atrum/marketContext";
import { useWallet } from "@/lib/atrum/wallet";
import { useDetailMode } from "@/lib/atrum/detailMode";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import NumberTicker from "@/components/atrum/ui/motion/NumberTicker";
import Logo from "./Logo";

const NAV = [
  { href: "/start", label: "Guide" },
  { href: "/markets", label: "Markets" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/wallet", label: "Wallet" },
  { href: "/privacy", label: "How it's private" },
] as const;

function navLinkStyle(active: boolean) {
  return {
    padding: "6px 0",
    fontSize: 11,
    textTransform: "uppercase" as const,
    letterSpacing: "0.16em",
    color: active ? color.ivory : color.smoke,
    borderBottom: `1px solid ${active ? color.ivory : "transparent"}`,
    transition: `color ${motionTokens.control}`,
  };
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

function AnonymityIndicator() {
  const { pool } = useMarket();
  const { mode } = useDetailMode();
  if (!pool) return null;
  const ok = pool.anonymityOk;

  if (mode === "detailed") {
    return (
      <div className="flex items-center gap-3">
        <span className="text-[11px] uppercase tracking-[0.16em] text-ash">Anonymity set</span>
        <NumberTicker
          value={pool.totalDeposits}
          format={(n) => String(Math.round(n)).padStart(2, "0")}
          className={`font-mono text-xl ${ok ? "text-ivory" : "text-ember"}`}
        />
        <span className="text-[13px] text-pewter">/ {pool.minAnonymitySet} floor</span>
        <div className="h-4 w-px bg-slate" />
      </div>
    );
  }

  // Simple mode: a compact status dot instead of the raw protocol figures, with the real
  // numbers a hover away rather than gone entirely.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2 cursor-default">
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-ivory" : "bg-ember"}`}
          />
          <span className="text-[11px] uppercase tracking-[0.16em] text-smoke">
            {ok ? "Private" : "Building anonymity"}
          </span>
          <div className="h-4 w-px bg-slate" />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {pool.totalDeposits} / {pool.minAnonymitySet} notes in the shared pool
      </TooltipContent>
    </Tooltip>
  );
}

export default function Header() {
  const pathname = usePathname();
  const { address, session, chainOk, connecting, connect, disconnect, switchChain } = useWallet();
  const { mode, setMode } = useDetailMode();

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

      <AnonymityIndicator />

      <Tabs value={mode} onValueChange={(v) => setMode(v as "simple" | "detailed")}>
        <TabsList>
          <TabsTrigger value="simple">Simple</TabsTrigger>
          <TabsTrigger value="detailed">Detailed</TabsTrigger>
        </TabsList>
      </Tabs>

      {!session ? (
        <button
          onClick={() => connect()}
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
