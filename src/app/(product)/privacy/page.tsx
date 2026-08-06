import Link from "next/link";
import { color, font } from "@/lib/atrum/theme";
import Panel from "@/components/atrum/ui/Panel";
import Label from "@/components/atrum/ui/Label";
import Detail from "@/components/atrum/ui/Detail";

const STAGES = [
  {
    title: "Deposit",
    simple: "Your funds enter the shared pool. This step is public — the pool has to pull collateral from your address.",
    detailed:
      "Deposits and withdrawals happen on the open chain with your address on them. That is true now and will stay true — the pool pulls collateral from you, so whoever pays is visible. Everything between them is sealed.",
  },
  {
    title: "Joining the pool",
    simple: "Your deposit waits briefly to join a batch of other deposits. That wait is what makes it indistinguishable from everyone else's.",
    detailed:
      "You cannot bet until your note lands in the tree. That is not latency — it is your note entering beside others in batches of 64, which is the whole of what makes it indistinguishable. A deposit names no market, so every unspent note in the system is part of the set, not just one market's.",
  },
  {
    title: "Trading (encrypted)",
    simple: "Your bet is submitted by a relayer, not your own wallet — your address never appears next to it.",
    detailed:
      "A bet proves a set of constraints against a proving key. Your address never appears beside the bet on chain because a relayer submits it — the relayer knows it was you, but that knowledge doesn't reach the chain. Trust is relocated, not removed.",
  },
  {
    title: "The odds",
    simple: "Individual stakes are always encrypted. Only the running total is ever visible.",
    detailed:
      "Individual stakes are encrypted on chain. The displayed ratio is the pool total decrypted for display — in a production deployment it's published coarsely and on a cadence, because a precise live ratio lets an observer solve backwards for a single stake.",
  },
  {
    title: "Claiming a win",
    simple: "Claiming doesn't pay you directly — it turns your win into a new, separate balance.",
    detailed:
      "Redeeming pays into a shielded note rather than paying out directly; no collateral moves and nothing is published. Withdrawing is a separate, later step, taken whenever you like — that split is what protects a winner from being identified by their payout.",
  },
  {
    title: "Sending out",
    simple: "A win leaves in a fixed amount, to any address you choose, whenever you choose. Waiting a bit first keeps it private.",
    detailed:
      "A settled note leaves in a fixed denomination, to any address you name, at any hour you choose. Waiting is itself privacy: the longer between redeeming and withdrawing, the less the two look related.",
  },
] as const;

export default function PrivacyPage() {
  return (
    <main style={{ padding: "80px 64px 128px", maxWidth: 900 }}>
      <h1 style={{ fontFamily: font.display, fontWeight: 400, fontSize: "clamp(30px,3.6vw,46px)", color: color.ivory, margin: "0 0 16px" }}>
        How this stays private
      </h1>
      <p style={{ margin: "0 0 56px", fontSize: 19, color: color.smoke, maxWidth: "62ch" }}>
        The odds are public. Your position is not. Here is the whole mechanism, one stage at a time — tap any
        stage for the exact protocol detail.
      </p>

      <div className="flex flex-col gap-px bg-hairline border border-hairline">
        {STAGES.map((stage, i) => (
          <Panel key={stage.title} className="bg-basalt border-0" padding="p-8">
            <div className="flex items-baseline gap-4 mb-3">
              <span style={{ fontFamily: font.mono, fontSize: 13, color: color.ash }}>{String(i + 1).padStart(2, "0")}</span>
              <Label className="text-bone normal-case tracking-normal text-base">{stage.title}</Label>
            </div>
            <p style={{ margin: "0 0 4px", fontSize: 16, color: color.pewter, maxWidth: "68ch" }}>{stage.simple}</p>
            <Detail summary="The exact protocol detail">
              <p style={{ margin: 0, fontSize: 15, color: color.smoke, maxWidth: "68ch" }}>{stage.detailed}</p>
            </Detail>
          </Panel>
        ))}
      </div>

      <p style={{ margin: "40px 0 0", fontSize: 17, color: color.smoke }}>
        Want to see this for one of your own trades?{" "}
        <Link href="/portfolio" style={{ color: color.halo }}>
          Open your portfolio →
        </Link>
      </p>
    </main>
  );
}
