import { cn } from "@/lib/utils";

/**
 * Loading placeholder in the real grid/row shape, replacing plain "Loading…" text. Mined from
 * the standard shimmer-skeleton technique, restyled to basalt/hairline/white-at-5% -- no default
 * library gradient colors.
 */
export default function Shimmer({
  className,
  style,
  children,
}: {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("relative overflow-hidden border border-hairline bg-basalt", className)} style={style}>
      {children}
      <div className="absolute inset-0 animate-[atrum-shimmer-sweep_1600ms_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
    </div>
  );
}
