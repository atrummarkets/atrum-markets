import Link from "next/link";
import LockupMark from "./logo/LockupMark";
import EmblemMark from "./logo/EmblemMark";

const ASPECT = { lockup: 1154 / 357, emblem: 691 / 789 } as const;

interface LogoProps {
  /** Rendered height in px -- width follows the mark's real aspect ratio. */
  size?: number;
  /** Wraps the whole thing in a Link when set. */
  href?: string;
  /** `lockup` (default) for places with horizontal room; `emblem` for narrow rails. */
  variant?: keyof typeof ASPECT;
  className?: string;
}

/**
 * Inline SVG, `fill="currentColor"` -- unlike the flat-ivory raster this replaced, `color` on a
 * wrapping element (or the `hover:text-halo` below, when linked) actually recolors the mark.
 */
export default function Logo({ size = 22, href, variant = "lockup", className }: LogoProps) {
  const Mark = variant === "emblem" ? EmblemMark : LockupMark;
  const content = (
    <Mark style={{ height: size, width: size * ASPECT[variant], display: "block" }} className={className} />
  );

  if (!href) return <span className="inline-flex text-ivory">{content}</span>;
  return (
    // globals.css puts a border-bottom "underline" on every <a> -- override it here, this is a
    // logo, not a text link.
    <Link
      href={href}
      className="inline-flex text-ivory transition-colors duration-control ease-control hover:text-halo"
      style={{ borderBottom: "none" }}
    >
      {content}
    </Link>
  );
}
