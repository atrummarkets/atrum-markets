import Link from "next/link";
import { color, font, type, space } from "@/lib/atrum/theme";
import Panel from "@/components/atrum/ui/Panel";
import Label from "@/components/atrum/ui/Label";
import {
  AS_OF,
  SIZE,
  GROWTH,
  CONCENTRATION,
  SURVEILLANCE,
  PRIVACY_DEMAND,
  RISKS,
  type Cited,
} from "@/lib/atrum/research";

/**
 * The market for a private prediction market.
 *
 * WRITTEN TO BE FACT-CHECKED. Every figure shows its measurement date and links to its source,
 * and the risks section runs at full size rather than shrinking into a disclaimer -- the
 * regulatory direction is the strongest argument against this company and a reader will find it
 * in four minutes whether or not we raise it. Raising it first is the only version that survives
 * a diligence call.
 *
 * THE STRUCTURE IS A FUNNEL, DELIBERATELY: the category is enormous, the volume is concentrated
 * in a tiny cohort, that cohort is measurably harmed by transparency, and privacy demand is
 * observable elsewhere. Each step narrows the number. Stopping at the top of the funnel would be
 * quoting a trillion-dollar TAM next to a testnet product, which is the genre of slide this page
 * exists to not be.
 *
 * No Atrum figures appear here. It is a page about the category.
 */

export const metadata = {
  title: "Atrum — The market",
  description: "Prediction markets got big and transparent at the same time. The research, dated and sourced.",
};

export default function ThesisPage() {
  return (
    <main style={{ padding: `${space.pageYTop}px ${space.pageX}px ${space.pageYBottom}px`, maxWidth: 980 }}>
      <Label className="text-champagne">Market · research as of {AS_OF}</Label>
      <h1
        style={{
          fontFamily: font.display,
          fontWeight: 400,
          fontSize: type.display2,
          color: color.ivory,
          margin: "14px 0 16px",
          maxWidth: "20ch",
          lineHeight: 1.08,
        }}
      >
        Prediction markets got big. They got transparent at the same time.
      </h1>
      <p style={{ margin: "0 0 8px", fontSize: type.bodyLg, color: color.smoke, maxWidth: "62ch" }}>
        Every figure below is dated and linked. Nothing is modelled, extrapolated, or rounded in our favour, and where
        credible forecasts disagree, both are shown.
      </p>
      <p style={{ margin: "0 0 64px", fontSize: type.body, color: color.ash, maxWidth: "62ch" }}>
        No Atrum numbers appear on this page. It is about the category, not about us.
      </p>

      <Section n="01" title="The category is already large" />
      <StatGrid items={SIZE} />

      <Section n="02" title="And it arrived quickly" />
      <div className="flex flex-col gap-px bg-hairline border border-hairline" style={{ marginBottom: 72 }}>
        {GROWTH.map((g) => (
          <div key={g.fact} className="bg-basalt p-6 flex flex-wrap items-baseline gap-x-8 gap-y-2">
            <span style={{ fontFamily: font.mono, fontSize: 12, color: color.champagne, minWidth: 170 }}>
              {g.period}
            </span>
            <span style={{ flex: 1, minWidth: 280, fontSize: type.body, color: color.pewter, lineHeight: 1.6 }}>
              {g.fact} <Cite source={g.source} url={g.url} />
            </span>
          </div>
        ))}
      </div>

      <Section
        n="03"
        title="The money is a rounding error of the users"
        lede="This is the number that decides whether a privacy product has a customer. The median trader is not it."
      />
      <StatGrid items={CONCENTRATION} />

      <Section
        n="04"
        title="That cohort is being read in real time"
        lede="Public order flow is not a theoretical exposure. It is tooled, funded, and shipped by the venue itself."
      />
      <div className="flex flex-col gap-3" style={{ marginBottom: 72 }}>
        {SURVEILLANCE.map((s) => (
          <Panel key={s.title} padding="p-7" className="border-l-2 border-l-champagne">
            <div style={{ fontSize: 17, color: color.bone, marginBottom: 8 }}>{s.title}</div>
            <p style={{ margin: 0, fontSize: type.body, color: color.smoke, lineHeight: 1.65, maxWidth: "72ch" }}>
              {s.body} <Cite source={s.source} url={s.url} />
            </p>
          </Panel>
        ))}
      </div>

      <Section
        n="05"
        title="Privacy demand is observable, just not here yet"
        lede="Nobody has run this experiment on a prediction market. The closest measurable proxy is a liquid asset that offers a shielded option users must pay a real cost to take."
      />
      <StatGrid items={PRIVACY_DEMAND} />

      <Section n="06" title="What is actually addressable" />
      <Panel padding="p-8" className="mb-[72px]">
        {[
          {
            k: "Category",
            v: "Roughly $40B+ monthly across the two majors, mid-2026",
            d: "Bernstein and Macquarie both model $1T–1.5T annually by 2030. This is the headline number and the least useful one.",
          },
          {
            k: "Addressable",
            v: "The on-chain venue only",
            d: "Kalshi KYCs every user and is CFTC-registered; that volume is structurally closed to a private protocol. What remains is crypto-native, non-US on-chain flow.",
          },
          {
            k: "The wedge",
            v: "The traders whose flow is worth copying",
            d: "Under 1% of wallets take half the profits and about 3% drive price discovery. They are the only cohort paying a measurable cost for transparency today, and the only one with a reason to accept a lock-up in exchange for privacy.",
          },
        ].map((row, i, arr) => (
          <div
            key={row.k}
            className="flex flex-wrap gap-x-8 gap-y-2"
            style={{
              padding: "18px 0",
              borderBottom: i < arr.length - 1 ? `1px solid ${color.hairline}` : "none",
            }}
          >
            <Label className="min-w-[120px] pt-1">{row.k}</Label>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ fontSize: 17, color: color.bone, marginBottom: 5 }}>{row.v}</div>
              <div style={{ fontSize: 15, color: color.smoke, lineHeight: 1.6, maxWidth: "68ch" }}>{row.d}</div>
            </div>
          </div>
        ))}
      </Panel>

      <Section
        n="07"
        title="What argues against this"
        lede="Not a disclaimer. The first item is the strongest case against the company, and it is checkable in about four minutes."
      />
      <div className="flex flex-col gap-3" style={{ marginBottom: 56 }}>
        {RISKS.map((r) => (
          <Panel key={r.title} padding="p-7" className="border-l-2 border-l-ember">
            <div style={{ fontSize: 17, color: color.bone, marginBottom: 8 }}>{r.title}</div>
            <p style={{ margin: 0, fontSize: type.body, color: color.smoke, lineHeight: 1.65, maxWidth: "72ch" }}>
              {r.body} {r.source && r.url && <Cite source={r.source} url={r.url} />}
            </p>
          </Panel>
        ))}
      </div>

      {/*
        Answered plainly because it is the first question a regulator-minded reader asks, and the
        honest answer is an architectural fact rather than a policy promise. Claiming a compliance
        story we have not built would be the single most damaging sentence on this page.
      */}
      <Panel padding="p-8" className="border-hairlineStrong">
        <Label className="text-champagne">On the insider-trading question</Label>
        <p style={{ margin: "12px 0 0", fontSize: type.body, color: color.pewter, lineHeight: 1.7, maxWidth: "72ch" }}>
          Atrum hides position and size from other traders. It is not a black box. Deposits and withdrawals sit on chain
          with addresses attached, and a bet reaches the chain through an authenticated relay session, so the operator
          can correlate a submission with an account even though the chain cannot. That is stated as an architectural
          fact, not as a compliance offering — no such tooling has been built, and a serious answer here is a
          prerequisite for any regulated market rather than an afterthought.
        </p>
      </Panel>

      <p style={{ margin: "48px 0 0", fontSize: 17, color: color.smoke }}>
        The mechanism behind the claim is written up separately.{" "}
        <Link href="/privacy" style={{ color: color.halo }}>
          How this stays private →
        </Link>
      </p>
    </main>
  );
}

/* ------------------------------------------------------------------ parts */

function Section({ n, title, lede }: { n: string; title: string; lede?: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div className="flex items-baseline gap-4">
        <span style={{ fontFamily: font.mono, fontSize: 13, color: color.ash }}>{n}</span>
        <h2 style={{ fontFamily: font.display, fontWeight: 400, fontSize: type.display3, color: color.bone, margin: 0 }}>
          {title}
        </h2>
      </div>
      {lede && (
        <p style={{ margin: "10px 0 0", fontSize: type.body, color: color.smoke, maxWidth: "68ch", lineHeight: 1.6 }}>
          {lede}
        </p>
      )}
    </div>
  );
}

function StatGrid({ items }: { items: Cited[] }) {
  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", marginBottom: 72 }}
    >
      {items.map((f) => (
        <Panel key={f.label} padding="p-6" className="flex flex-col">
          <div style={{ fontFamily: font.mono, fontSize: 30, color: color.ivory, lineHeight: 1.1 }}>{f.value}</div>
          <div style={{ fontSize: 15, color: color.pewter, margin: "10px 0 6px", lineHeight: 1.45 }}>{f.label}</div>
          {f.note && (
            <div style={{ fontSize: 14, color: color.smoke, lineHeight: 1.55, marginBottom: 10 }}>{f.note}</div>
          )}
          <div style={{ marginTop: "auto", paddingTop: 12, fontFamily: font.mono, fontSize: 11, color: color.ash }}>
            {f.when} · <Cite source={f.source} url={f.url} />
          </div>
        </Panel>
      ))}
    </div>
  );
}

/** A source link. Present on every claim — that is the entire point of the page. */
function Cite({ source, url }: { source: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      style={{ color: color.champagne, fontFamily: font.mono, fontSize: 11, whiteSpace: "nowrap" }}
    >
      {source}
    </a>
  );
}
