"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { color, font, motion } from "@/lib/atrum/theme";
import { useMarket } from "@/lib/atrum/marketContext";
import { headTicks } from "@/lib/atrum/ticks";
import TickBar from "./TickBar";

const NAV = [
  { href: "/market", label: "Market" },
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

export default function Header() {
  const pathname = usePathname();
  const { anonymitySet, anonymityOk } = useMarket();

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        gap: 64,
        height: 64,
        padding: "0 32px",
        background: color.void,
        borderBottom: `1px solid ${color.hairline}`,
      }}
    >
      <div style={{ fontFamily: font.wordmark, fontWeight: 700, fontSize: 15, letterSpacing: "0.16em", color: color.ivory }}>
        ATRUM
      </div>

      <nav style={{ display: "flex", gap: 32 }}>
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} style={navLinkStyle(pathname === item.href)}>
            {item.label}
          </Link>
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <TickBar ticks={headTicks(anonymitySet, anonymityOk)} height={14} transition={`background ${motion.local}`} />
        <div style={{ width: 1, height: 16, background: color.slate }} />
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.16em", color: color.ash }}>
          Anonymity set
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span
            style={{
              fontFamily: font.mono,
              fontSize: 20,
              color: anonymityOk ? color.ivory : color.ember,
              transition: `color ${motion.panel}`,
            }}
          >
            {String(anonymitySet).padStart(2, "0")}
          </span>
          <span style={{ fontSize: 13, color: color.pewter }}>look like yours</span>
        </div>
      </div>
    </header>
  );
}
