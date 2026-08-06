import Link from "next/link";

const ASPECT = 1154 / 357;

interface LogoProps {
  /** Rendered height in px -- width follows the asset's real aspect ratio. */
  size?: number;
  /** Wraps the whole thing in a Link when set. */
  href?: string;
}

/**
 * The single Atrum wordmark asset (public/uploads/atrum-wordmark-ivory.png) -- mark and
 * lettering are one flat-ivory graphic, not assembled from a separate glyph image + CSS text.
 */
export default function Logo({ size = 22, href }: LogoProps) {
  const content = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/uploads/atrum-wordmark-ivory.png"
      alt="Atrum"
      style={{ height: size, width: size * ASPECT }}
    />
  );

  if (!href) return <span style={{ display: "inline-flex" }}>{content}</span>;
  return (
    // globals.css puts a border-bottom "underline" on every <a> -- override it here, this is a
    // logo, not a text link.
    <Link href={href} style={{ display: "inline-flex", borderBottom: "none" }}>
      {content}
    </Link>
  );
}
