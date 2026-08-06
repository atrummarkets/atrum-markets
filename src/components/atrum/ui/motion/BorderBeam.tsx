import { cn } from "@/lib/utils";

/**
 * Mined from Magic UI's BorderBeam technique (conic-gradient ring, masked to the border, angle
 * driven by an animated `@property`) -- restyled to a single thin halo beam. Reads as "working,"
 * never implies a percentage: it disappears entirely once the panel it's on un-mounts, same rule
 * ActivityOverlay already follows for not showing a fake progress bar.
 */
export default function BorderBeam({
  className,
  color = "var(--color-halo)",
  durationMs = 3200,
  widthPx = 1,
}: {
  className?: string;
  color?: string;
  durationMs?: number;
  widthPx?: number;
}) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 rounded-[inherit]", className)}
      style={{
        padding: widthPx,
        background: `conic-gradient(from var(--atrum-beam-angle), transparent 0%, ${color} 10%, transparent 22%)`,
        WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
        WebkitMaskComposite: "xor",
        maskComposite: "exclude",
        animation: `atrum-beam-spin ${durationMs}ms linear infinite`,
      }}
    />
  );
}
