import Link from "next/link";

/** Off-site. Opened in a new tab so a click does not abandon an in-flight action. */
const EXTERNAL = [
  { href: "https://x.com/AtrumMarkets", label: "X" },
  { href: "https://docs.atrum.fun", label: "Docs" },
  { href: "https://github.com/atrummarkets", label: "GitHub" },
] as const;

const linkClass =
  "text-[12px] uppercase tracking-[0.14em] text-pewter no-underline transition-colors duration-control ease-control hover:text-ivory";

export default function Footer() {
  return (
    <footer className="flex items-center justify-center gap-8 border-t border-hairline px-8 py-6">
      {/*
        The footer is the only route to /status, and deliberately so. It is where someone looks
        when the site seems stuck -- which is exactly when that page is worth reading -- and it
        keeps operational detail out of the main navigation, where it would be noise for someone
        trying to place a bet. The same page carries the operator panel, shown only to the
        operator's own wallet.

        Internal, so `next/link` rather than a bare anchor: a full page load here would drop the
        wallet connection and the market poll.
      */}
      <Link href="/status" className={linkClass}>
        Status
      </Link>
      {EXTERNAL.map((link) => (
        <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className={linkClass}>
          {link.label}
        </a>
      ))}
    </footer>
  );
}
