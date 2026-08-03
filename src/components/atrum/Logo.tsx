import Link from "next/link";
import { color, font } from "@/lib/atrum/theme";

export type LogoVariant = "mark" | "lockup" | "wordmark";

interface LogoProps {
  /** mark: just the glyph. wordmark: just "ATRUM" text. lockup: both, glyph first. */
  variant?: LogoVariant;
  /** Basis for sizing -- the glyph's rendered height in px; wordmark size and gap scale from it. */
  size?: number;
  /** Wraps the whole thing in a Link when set. */
  href?: string;
  tint?: string;
}

/**
 * The one place the Atrum mark + wordmark are assembled, built from the existing chrome-"A"
 * asset (public/uploads/atrum-logo.png, previously only shown once in BootOverlay) and the
 * existing wordmark font token (theme.ts's font.wordmark) -- no new brand files.
 */
export default function Logo({ variant = "lockup", size = 22, href, tint }: LogoProps) {
  const content = (
    <span style={{ display: "inline-flex", alignItems: "center", gap: Math.round(size * 0.4) }}>
      {variant !== "wordmark" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/uploads/atrum-logo.png"
          alt={variant === "mark" ? "Atrum" : ""}
          style={{ height: size, width: "auto", display: "block" }}
        />
      )}
      {variant !== "mark" && (
        <span
          style={{
            fontFamily: font.wordmark,
            fontWeight: 700,
            fontSize: Math.round(size * 0.68),
            letterSpacing: "0.16em",
            color: tint ?? color.ivory,
          }}
        >
          ATRUM
        </span>
      )}
    </span>
  );

  if (!href) return content;
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      {content}
    </Link>
  );
}
