"use client";

import { use, type ReactNode } from "react";
import Link from "next/link";
import { color, font } from "@/lib/atrum/theme";
import { useMarket, type Receipt } from "@/lib/atrum/marketContext";
import type { LiveMarket, LiveNote } from "@/lib/atrum/api";
import { formatElapsed, formatGas, shortHash, shortAddress, txUrl, addressUrl } from "@/lib/atrum/format";
import Panel from "@/components/atrum/ui/Panel";
import Label from "@/components/atrum/ui/Label";
import StatRow from "@/components/atrum/ui/StatRow";
import AnimatedList from "@/components/atrum/ui/motion/AnimatedList";

const ACTION_TITLE: Record<Receipt["kind"], string> = {
  deposit: "Deposited",
  bet: "Bet placed",
  redeem: "Winnings claimed",
  withdraw: "Sent to your wallet",
};

interface TraceStep {
  key: string;
  title: string;
  body: string;
  rows: [string, ReactNode][];
}

function relayedRows(r: Receipt): [string, ReactNode][] {
  const rows: [string, ReactNode][] = [
    [
      "Transaction",
      <a key="tx" href={txUrl(r.txHash)} target="_blank" rel="noreferrer" style={{ color: color.halo, textDecoration: "none" }}>
        {shortHash(r.txHash)} ↗
      </a>,
    ],
  ];
  rows.push([
    "Submitted by",
    r.relayer ? (
      <a key="relayer" href={addressUrl(r.relayer)} target="_blank" rel="noreferrer" style={{ color: color.pewter, textDecoration: "none" }}>
        relayer {shortAddress(r.relayer)} ↗
      </a>
    ) : (
      "your wallet"
    ),
  ]);
  if (r.gasUsed) rows.push(["Gas used", formatGas(r.gasUsed)]);
  if (r.provingMs !== undefined) rows.push(["Proving time", formatElapsed(r.provingMs)]);
  if (r.anonymitySetAtTime !== null && r.anonymitySetAtTime !== undefined) {
    rows.push(["Anonymity set then", `${r.anonymitySetAtTime} notes in the pool`]);
  }
  return rows;
}

function statusBody(note: LiveNote, market: LiveMarket | undefined) {
  if (note.status === "spent") return "This note has been fully used — it can't be spent again.";
  if (note.status === "queued") return "Waiting to join the shared pool before it can be used.";
  if (note.outcome === 0) return "Sitting as spendable balance — usable in any market, or sendable back out.";
  if (note.outcome === 3) return "Settled. Ready to send to your wallet whenever you choose.";
  if (market?.settled) return "This position's market has settled.";
  return "An open, sealed position — nothing about it is public until its market settles.";
}

export default function NoteTracePage({ params }: { params: Promise<{ noteId: string }> }) {
  const { noteId } = use(params);
  const { notes, receiptHistory, markets } = useMarket();

  const note = notes.find((n) => n.id === noteId);
  const createdBy = receiptHistory.find((r) => r.noteId === noteId);
  const spentBy = receiptHistory.find((r) => r.spentNoteId === noteId);
  const market = note ? markets.find((m) => String(m.marketId) === note.marketId) : undefined;

  const steps: TraceStep[] = [];

  if (createdBy) {
    steps.push({
      key: "created",
      title: ACTION_TITLE[createdBy.kind],
      body: createdBy.relayer
        ? "A relayer submitted this, so your address never appeared beside it on chain — the relayer knows it was you, that knowledge doesn't reach the chain."
        : "Signed directly by your wallet. This is the boundary, and it's public by design.",
      rows: relayedRows(createdBy),
    });
  } else if (note?.txHash) {
    steps.push({
      key: "created-thin",
      title: "Created",
      body: "This note's origin is from before this session started — only its on-chain transaction is visible now.",
      rows: [
        [
          "Transaction",
          <a key="tx" href={txUrl(note.txHash)} target="_blank" rel="noreferrer" style={{ color: color.halo, textDecoration: "none" }}>
            {shortHash(note.txHash)} ↗
          </a>,
        ],
      ],
    });
  }

  if (note) {
    const rows: [string, ReactNode][] = [
      ["Units", note.units],
      ["Status", note.status],
    ];
    if (market) rows.push(["Market", `#${market.marketId} — ${market.question}`]);
    steps.push({ key: "status", title: "Current status", body: statusBody(note, market), rows });
  }

  if (spentBy) {
    steps.push({
      key: "spent",
      title: ACTION_TITLE[spentBy.kind],
      body: spentBy.relayer
        ? "A relayer submitted this, so your address never appeared beside it on chain."
        : "Signed directly by your wallet.",
      rows: relayedRows(spentBy),
    });
    if (spentBy.noteId) {
      steps.push({
        key: "continues",
        title: "Continues as a new note",
        body: "That action created a new note — its trace picks up from here.",
        rows: [
          [
            "New note",
            <Link key="link" href={`/privacy/${spentBy.noteId}`} style={{ color: color.halo }}>
              0x{spentBy.noteId} →
            </Link>,
          ],
        ],
      });
    }
  }

  if (!note && steps.length === 0) {
    return (
      <main style={{ padding: "96px 64px", maxWidth: 640 }}>
        <h1 style={{ fontFamily: font.display, fontWeight: 400, fontSize: 34, color: color.ivory, margin: "0 0 16px" }}>
          Nothing to show
        </h1>
        <p style={{ margin: "0 0 24px", fontSize: 17, color: color.smoke }}>
          Nothing about note 0x{noteId} is visible this session — it may be from an earlier session, or the id is
          wrong.
        </p>
        <Link href="/portfolio" style={{ color: color.halo, fontSize: 15 }}>
          ← Back to your portfolio
        </Link>
      </main>
    );
  }

  return (
    <main style={{ padding: "80px 64px 128px", maxWidth: 800 }}>
      <Link href="/portfolio" style={{ fontSize: 13, color: color.ash, textDecoration: "none" }}>
        ← Your portfolio
      </Link>

      <h1 style={{ fontFamily: font.display, fontWeight: 400, fontSize: "clamp(28px,4vw,44px)", color: color.ivory, margin: "32px 0 16px" }}>
        How note 0x{noteId} stayed private
      </h1>
      <p style={{ margin: "0 0 48px", fontSize: 17, color: color.smoke, maxWidth: "62ch" }}>
        Only what actually happened, this session — nothing padded in, nothing guessed. A stage that isn&apos;t
        shown didn&apos;t happen yet, or happened before this session started.
      </p>

      <AnimatedList
        items={steps}
        keyExtractor={(s) => s.key}
        className="flex flex-col gap-px bg-hairline border border-hairline"
        renderItem={(s) => (
          <Panel className="bg-basalt border-0">
            <Label className="mb-3 block">{s.title}</Label>
            <p style={{ margin: "0 0 20px", fontSize: 16, color: color.pewter }}>{s.body}</p>
            <div style={{ borderTop: `1px solid ${color.hairline}` }}>
              {s.rows.map(([k, v]) => (
                <StatRow key={k} label={k}>
                  {v}
                </StatRow>
              ))}
            </div>
          </Panel>
        )}
      />
    </main>
  );
}
