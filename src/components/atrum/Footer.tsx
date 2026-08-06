const LINKS = [
  { href: "https://x.com/AtrumMarkets", label: "X" },
  { href: "https://docs.atrum.fun", label: "Docs" },
  { href: "https://github.com/atrummarkets", label: "GitHub" },
] as const;

export default function Footer() {
  return (
    <footer className="flex items-center justify-center gap-8 border-t border-hairline px-8 py-6">
      {LINKS.map((link) => (
        <a
          key={link.href}
          href={link.href}
          target="_blank"
          rel="noreferrer"
          className="text-[12px] uppercase tracking-[0.14em] text-pewter no-underline transition-colors duration-control ease-control hover:text-ivory"
        >
          {link.label}
        </a>
      ))}
    </footer>
  );
}
