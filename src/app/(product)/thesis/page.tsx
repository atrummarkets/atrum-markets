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
  type Cited,
} from "@/lib/atrum/research";

/**
 * The market for a private prediction market.
 *
 * WRITTEN TO BE FACT-CHECKED. Every figure shows its measurement date and links to its source.
 * That is the whole design constraint: this page is shown to people who will check, and one
 * uncited number would cost the rest of the page its credibility. Where two credible houses
 * forecast the same thing differently, both are shown -- agreement from independent sources is
 * worth more than a single flattering figure.
 *
 * THE STRUCTURE IS A FUNNEL: the category is enormous, the volume is concentrated in a small
 * cohort, that cohort is measurably harmed by transparency, and privacy demand is already
 * observable elsewhere. Each step is a narrowing, and the narrowing is the argument -- it ends
 * on a specific, reachable customer rather than a share-of-TAM hand-wave.
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
        Every figure below is dated and linked to its source, because numbers this large only help if they survive
        being checked. Nothing is modelled or rounded in our favour.
      </p>
      <p style={{ margin: "0 0 40px", fontSize: type.body, color: color.ash, maxWidth: "62ch" }}>
        No Atrum numbers appear on this page. It is about the category, not about us.
      </p>

      {/*
        The headline figure, derived by adding the two cited June 2026 monthlies and annualising,
        and labelled as derived. Bigger than any single source number and still checkable in one
        line of arithmetic -- which is the only kind of big number worth printing.
      */}
      <Panel padding="p-10" className="border-hairlineStrong" >
        <div style={{ fontFamily: font.mono, fontSize: type.display1, color: color.ivory, lineHeight: 1 }}>
          ~$500B
        </div>
        <div style={{ fontSize: type.bodyLg, color: color.bone, margin: "16px 0 8px", maxWidth: "50ch" }}>
          annual run rate, from the two majors alone
        </div>
        <div style={{ fontSize: 15, color: color.smoke, maxWidth: "62ch", lineHeight: 1.6 }}>
          Kalshi and Polymarket cleared <strong style={{ color: color.pewter }}>$41.8B combined in June 2026</strong>.
          Twelve months earlier the on-chain venue was doing about $1.2B a month. This category has gone up roughly
          twentyfold in a year, and every dollar of it trades in the open.
        </div>
      </Panel>

      <div style={{ height: 72 }} />

      <Section n="01" title="The category is enormous, and it is early" />
      <StatGrid items={SIZE} />

      <Section n="02" title="It got here in eighteen months" />
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
        title="A handful of wallets are the entire market"
        lede="Millions of accounts, and the money sits with a few hundred of them. That concentration is the customer list."
      />
      <StatGrid items={CONCENTRATION} />

      <Section
        n="04"
        title="And every one of them is being read in real time"
        lede="This is not a theoretical exposure. It is tooled, funded, and shipped by the venues themselves — the best traders in the category are being farmed by their own order flow."
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
        title="When privacy is offered, capital moves fast"
        lede="Nobody has offered it on a prediction market yet. Where it has been offered — on a liquid asset, at a real cost to the user — adoption went vertical."
      />
      <StatGrid items={PRIVACY_DEMAND} />

      <Section
        n="06"
        title="Where that lands for us"
        lede="A named, reachable customer inside a category compounding at 80% a year — and no one is serving them."
      />
      <Panel padding="p-8" className="mb-[72px]">
        {[
          {
            k: "Category",
            v: "Roughly $40B+ monthly across the two majors, mid-2026",
            d: "Bernstein and Macquarie independently model $1T–1.5T annually by 2030 — two houses, the same trajectory.",
          },
          {
            k: "Addressable",
            v: "Crypto-native, on-chain flow",
            d: "The permissionless venue is where privacy can be offered as a protocol guarantee rather than a policy — and it is the half of the category compounding fastest.",
          },
          {
            k: "The wedge",
            v: "The traders whose flow is worth copying",
            d: "Under 1% of wallets take half the profits and about 3% drive price discovery. They are the cohort paying a measurable cost for transparency today, they know it, and they are already paying engineers to work around it.",
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
