"use client";

import Link from "next/link";
import { c, line, fill, font } from "@/lib/atrum/v2/tokens";
import { useMarket } from "@/lib/atrum/marketContext";
import { useDetailMode } from "@/lib/atrum/detailMode";

/**
 * Why this is private — and where it is not.
 *
 * TWO ALTITUDES, ONE TOGGLE. The plain reading is the default; PROTOCOL in the header swaps in
 * the mechanism. It reuses the same `DetailModeProvider` as every other v2 screen rather than
 * inventing a second notion of the same thing.
 *
 * THE LIMITS SECTION IS NOT OPTIONAL AND IS NOT COLLAPSED. A privacy page that lists only the
 * guarantees is marketing. Everything below traces to something real in this deployment: the
 * deposit is public because `transferFrom(msg.sender)` makes the payer public, the relay session
 * genuinely correlates the requester, and legacy notes created before client-side proving
 * genuinely still have server-held secrets until their owner migrates. Stating those is what
 * makes the rest of the page worth believing.
 *
 * Live figures come from the pool and the circuit manifest. Nothing here is a typed-in number
 * that could drift from what the contracts actually do.
 */

interface Stage {
  n: string;
  title: string;
  simple: string;
  detailed: string;
  /** "public" marks a step that is deliberately visible on chain. */
  tone: "public" | "sealed";
}

const STAGES: Stage[] = [
  {
    n: "01",
    title: "Deposit",
    tone: "public",
    simple:
      "Collateral leaves your address into a shared pool, and anyone can see it happen. This is the last moment you are visible.",
    detailed:
      "The pool pulls collateral with `transferFrom(msg.sender)`, so whoever pays is public by construction. Relaying it would only move the payment one hop — someone still has to hold the tokens. The deposit is accompanied by a Groth16 proof that the note commitment is well-formed, and the commitment itself reveals nothing about who made it.",
  },
  {
    n: "02",
    title: "Joining the crowd",
    tone: "sealed",
    simple:
      "Your note waits to be grafted into the tree alongside other people's. That wait is not latency — it is the privacy being made.",
    detailed:
      "Notes are grafted into a depth-20 Poseidon Merkle tree in batches. Until yours is in the tree you cannot spend it, and once it is, it is one leaf among every unspent note in the system. A deposit names no market, so the anonymity set is the whole pool rather than one market's participants.",
  },
  {
    n: "03",
    title: "Betting",
    tone: "sealed",
    simple:
      "You prove you own an unspent note without revealing which one. A relayer submits it, so your address never appears next to the bet.",
    detailed:
      "The circuit proves Merkle membership of your note under the current root, reveals a nullifier that prevents double-spending, and outputs a fresh position commitment. The nullifier is a hash of the note secret — unlinkable to the commitment it retires. The pool checks the proof, not the sender, so `betEncrypted` is proof-gated rather than sender-gated and any relayer can submit it.",
  },
  {
    n: "04",
    title: "Your stake, encrypted",
    tone: "sealed",
    simple:
      "The amount you bet is encrypted on chain. Only the running total for each side is ever readable.",
    detailed:
      "Stakes are ElGamal ciphertexts on the BabyJubJub curve, which are additively homomorphic: the contract adds encrypted stakes together without ever decrypting one. The circuit constrains the ciphertext to encrypt the same value it just proved you spent, so you cannot bet 1 and claim 1000. Only the aggregate is decrypted, and only to display odds.",
  },
  {
    n: "05",
    title: "Claiming a win",
    tone: "sealed",
    simple:
      "Claiming does not pay you. It spends the winning note and mints a new sealed one — no collateral moves and nobody learns you won.",
    detailed:
      "Redeeming proves your position was on the winning side and that the payout equals `units × totalPool / winningPool`, truncated down, using the same arithmetic the contract settles with. The output is another commitment, not a transfer. Splitting the win from the exit is what stops a winner being identified by their payout landing.",
  },
  {
    n: "06",
    title: "Withdrawal",
    tone: "public",
    simple:
      "Money leaves in round chunks — 1, 10, 100, 1000 — to any address, whenever you choose. This step is public again.",
    detailed:
      "A withdrawal of 327 fingerprints the position that earned it; three 100s, two 10s and seven 1s look like everyone else's. Each chunk is a separate transaction that spends a note and mints a change note, so the remainder stays sealed. Time is the other half: the longer between claiming and withdrawing, the less the two look related.",
  },
];

/** Limits that are true of this deployment right now. Each one is checkable. */
const LIMITS: { title: string; body: string }[] = [
  {
    title: "The relayer knows it was you.",
    body: "Your address is not on the bet transaction, but you asked a relayer to submit it over an authenticated session, so the operator of that relayer can correlate the request with your account. The chain does not learn it; we do. Removing this needs blind-signed tokens so the relay can verify you are entitled to submit without learning who you are — designed, not yet shipped.",
  },
  {
    title: "The odds are aggregate, and aggregates leak.",
    body: "A precise, continuously updated pool ratio lets a determined observer solve backwards for a single stake, especially in a thin market. Nothing about a single position is published, but the ratio is a side channel, and this deployment publishes it live rather than coarsely.",
  },
  {
    title: "Notes made before client-side proving still have server-held secrets.",
    body: "Every note now is generated and proved in your browser and the server only ever sees ciphertext. Notes created before that change were made server-side, and their secrets are still in the database until their owner migrates to a vault. If that is you, unlocking your vault once is what moves them across.",
  },
  {
    title: "This is a testnet deployment.",
    body: "Contracts are unaudited, the trusted setup was run by us, and the committee decryption key is held by us. Nothing here should hold money you cannot lose.",
  },
];

export default function V2PrivacyPage() {
  const { pool, config, clientProving } = useMarket();
  const { mode } = useDetailMode();
  const detail = mode === "detailed";

  // Real figures or nothing — there is no fallback constant to drift from the deployment.
  const facts = [
    { v: pool ? pool.totalDeposits.toLocaleString("en-US") : "—", l: "NOTES IN THE POOL" },
    { v: config ? config.circuits.bet.constraints.toLocaleString("en-US") : "—", l: "CONSTRAINTS PER BET" },
    { v: clientProving ? "IN YOUR BROWSER" : "ON THE SERVER", l: "WHERE PROOFS ARE MADE" },
  ];

  return (
    <main style={{ maxWidth: 880, width: "100%", margin: "0 auto", padding: "36px 24px 96px", animation: "v2FadeIn .3s ease" }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 6px" }}>Why this is private</h1>
      <p style={{ color: c.dim, fontSize: 13.5, margin: "0 0 26px", maxWidth: 620, textWrap: "pretty" }}>
        The odds are public. Your position is not. Here is the whole mechanism, and the places where it stops.
        {!detail && " Turn on PROTOCOL in the header for the exact construction at each step."}
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 34 }}>
        {facts.map((f) => (
          <div key={f.l} style={{ flex: 1, minWidth: 190, border: `1px solid ${line.base}`, background: c.panel, borderRadius: 10, padding: "16px 18px" }}>
            <div style={{ fontFamily: font.mono, fontSize: 21, fontWeight: 500, color: c.text }}>{f.v}</div>
            <div style={{ fontFamily: font.mono, fontSize: 10, letterSpacing: "0.12em", color: c.faint, marginTop: 5 }}>{f.l}</div>
          </div>
        ))}
      </div>

      {/* ------------------------------------------------------------ stages */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 44 }}>
        {STAGES.map((s, i) => {
          const isPublic = s.tone === "public";
          return (
            <div
              key={s.n}
              style={{
                border: `1px solid ${isPublic ? "rgba(200,164,101,0.28)" : line.base}`,
                background: isPublic ? fill.goldFaint : c.panel,
                borderRadius: 11,
                padding: "20px 22px",
                animation: "v2FadeUp .4s ease both",
                animationDelay: `${i * 0.05}s`,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                <span style={{ fontFamily: font.mono, fontSize: 11, color: c.faint }}>{s.n}</span>
                <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{s.title}</h2>
                <span
                  style={{
                    fontFamily: font.mono,
                    fontSize: 9.5,
                    letterSpacing: "0.12em",
                    padding: "3px 7px",
                    borderRadius: 4,
                    marginLeft: "auto",
                    color: isPublic ? c.gold : c.green,
                    background: isPublic ? fill.gold : fill.green,
                  }}
                >
                  {isPublic ? "PUBLIC ON CHAIN" : "SEALED"}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 13.5, color: c.dim, lineHeight: 1.65, textWrap: "pretty" }}>{s.simple}</p>
              {detail && (
                <p
                  style={{
                    margin: "12px 0 0",
                    paddingTop: 12,
                    borderTop: `1px solid ${line.faint}`,
                    fontSize: 12.5,
                    color: c.bright,
                    lineHeight: 1.7,
                    textWrap: "pretty",
                  }}
                >
                  {s.detailed}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* ------------------------------------------------------------ limits */}
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 6px" }}>Where it stops</h2>
      <p style={{ color: c.dim, fontSize: 13.5, margin: "0 0 18px", maxWidth: 620, textWrap: "pretty" }}>
        Every privacy system has an edge. Knowing exactly where ours is worth more than a claim that it has none.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {LIMITS.map((l, i) => (
          <div
            key={l.title}
            style={{
              border: `1px solid ${line.base}`,
              borderLeft: `2px solid ${c.red}`,
              background: c.panel,
              borderRadius: 10,
              padding: "18px 20px",
              animation: "v2FadeUp .4s ease both",
              animationDelay: `${i * 0.05}s`,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{l.title}</div>
            <p style={{ margin: 0, fontSize: 12.5, color: c.dim, lineHeight: 1.65, textWrap: "pretty" }}>{l.body}</p>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 34, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/v2" style={btn}>
          BACK TO THE FLOOR
        </Link>
        <Link href="/status" style={{ ...btn, borderColor: line.faint, color: c.faint }}>
          LIVE SYSTEM STATUS
        </Link>
      </div>
    </main>
  );
}

const btn: React.CSSProperties = {
  border: `1px solid ${line.strong}`,
  color: c.bright,
  fontFamily: font.mono,
  fontSize: 12,
  letterSpacing: "0.08em",
  padding: "12px 22px",
  borderRadius: 8,
  textDecoration: "none",
};
