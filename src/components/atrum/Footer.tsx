import { color } from "@/lib/atrum/theme";

const LINKS = [
  { href: "https://x.com/AtrumMarkets", label: "X" },
  { href: "https://docs.atrum.fun", label: "Docs" },
  { href: "https://github.com/atrummarkets", label: "GitHub" },
] as const;

const linkStyle = {
  fontSize: 12,
  textTransform: "uppercase" as const,
  letterSpacing: "0.14em",
  color: color.pewter,
  textDecoration: "none",
};

export default function Footer() {
  return (
    <footer
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 32,
        padding: "24px 32px",
        borderTop: `1px solid ${color.hairline}`,
      }}
    >
      {LINKS.map((link) => (
        <a key={link.href} href={link.href} target="_blank" rel="noreferrer" style={linkStyle}>
          {link.label}
        </a>
      ))}
    </footer>
  );
}
