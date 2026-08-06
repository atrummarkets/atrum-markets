import { cn } from "@/lib/utils";

/** The `background: basalt, border: 1px hairline` container repeated across boundary/wallet
 * tiles, the market-page tile grid, and AnonymityPanel. */
export default function Panel({
  children,
  className,
  padding = "p-10",
}: {
  children: React.ReactNode;
  className?: string;
  padding?: string;
}) {
  return <div className={cn("border border-hairline bg-basalt", padding, className)}>{children}</div>;
}
