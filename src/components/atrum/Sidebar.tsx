"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMarket } from "@/lib/atrum/marketContext";
import { useWallet } from "@/lib/atrum/wallet";
import { useDetailMode } from "@/lib/atrum/detailMode";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Dialog, AtrumDialogContent } from "@/components/atrum/ui/Dialog";
import NumberTicker from "@/components/atrum/ui/motion/NumberTicker";
import PillButton from "@/components/atrum/ui/PillButton";
import Logo from "./Logo";
import { cn } from "@/lib/utils";

export const NAV = [
  { href: "/start", label: "Guide" },
  { href: "/markets", label: "Markets" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/wallet", label: "Wallet" },
  { href: "/privacy", label: "How it's private" },
] as const;

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

function AnonymityIndicator() {
  const { pool } = useMarket();
  const { mode } = useDetailMode();
  if (!pool) return null;
  const ok = pool.anonymityOk;

  if (mode === "detailed") {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-[0.16em] text-ash">Anonymity set</span>
        <div className="flex items-baseline gap-2">
          <NumberTicker
            value={pool.totalDeposits}
            format={(n) => String(Math.round(n)).padStart(2, "0")}
            className={`font-mono text-xl ${ok ? "text-ivory" : "text-ember"}`}
          />
          <span className="text-[13px] text-pewter">/ {pool.minAnonymitySet} floor</span>
        </div>
      </div>
    );
  }

  // Simple mode: a compact status dot instead of the raw protocol figures, with the real
  // numbers a hover away rather than gone entirely.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2 cursor-default">
          <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-ivory" : "bg-ember"}`} />
          <span className="text-[11px] uppercase tracking-[0.16em] text-smoke">
            {ok ? "Private" : "Building anonymity"}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {pool.totalDeposits} / {pool.minAnonymitySet} notes in the shared pool
      </TooltipContent>
    </Tooltip>
  );
}

function WalletButton() {
  const { address, session, chainOk, connecting, connect, disconnect, switchChain } = useWallet();

  if (!session) {
    return (
      <PillButton
        selected={false}
        onClick={() => connect()}
        disabled={connecting}
        unselectedClassName="w-full bg-transparent text-bone border-hairlineStrong"
        className="justify-center px-4 py-2.5"
      >
        {connecting ? "Connecting…" : "Connect wallet"}
      </PillButton>
    );
  }
  if (!chainOk) {
    return (
      <PillButton
        selected={false}
        onClick={switchChain}
        unselectedClassName="w-full bg-transparent text-ember border-ember"
        className="justify-center px-4 py-2.5"
      >
        Switch to Monad testnet
      </PillButton>
    );
  }
  return (
    <PillButton
      selected={false}
      onClick={disconnect}
      unselectedClassName="w-full bg-transparent text-pewter border-hairline"
      className="justify-center px-4 py-2.5"
    >
      <span title={address ?? undefined}>{short(session)}</span>
    </PillButton>
  );
}

function navLinkClass(active: boolean) {
  return cn(
    "flex items-center border-l-[3px] px-4 py-2.5 text-[11px] uppercase tracking-[0.16em] transition-colors duration-control ease-control",
    active ? "border-ivory text-ivory" : "border-transparent text-smoke hover:text-bone",
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { mode, setMode } = useDetailMode();

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-5">
        <Logo href="/markets" size={22} variant="emblem" />
      </div>

      <nav className="flex flex-col">
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new CustomEvent("atrum:open-command-palette"));
            onNavigate?.();
          }}
          className={cn(navLinkClass(false), "justify-between")}
        >
          <span>Search</span>
          <span className="font-mono normal-case tracking-normal text-ash">⌘K</span>
        </button>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={navLinkClass(pathname.startsWith(item.href))}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="flex-1" />

      <div className="flex flex-col gap-4 border-t border-hairline p-4">
        <AnonymityIndicator />
        <Tabs value={mode} onValueChange={(v) => setMode(v as "simple" | "detailed")}>
          <TabsList className="w-full">
            <TabsTrigger value="simple" className="flex-1">
              Simple
            </TabsTrigger>
            <TabsTrigger value="detailed" className="flex-1">
              Detailed
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <WalletButton />
      </div>
    </div>
  );
}

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <aside className="fixed left-0 top-8 bottom-0 z-20 hidden w-60 border-r border-hairline bg-void md:block">
        <SidebarContent />
      </aside>

      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setMobileOpen(true)}
        className="fixed left-2 top-2 z-30 flex h-6 w-6 items-center justify-center border border-hairlineStrong bg-basalt text-bone md:hidden"
      >
        <span aria-hidden className="font-mono text-xs">
          ☰
        </span>
      </button>

      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <AtrumDialogContent
          className="items-stretch justify-start p-0 md:hidden"
          overlayClassName="bg-void/80"
        >
          <div className="h-full w-72 border-r border-hairline bg-void">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </div>
        </AtrumDialogContent>
      </Dialog>
    </>
  );
}
