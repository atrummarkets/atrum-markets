import { cn } from "@/lib/utils";

/** The label/value row repeated in ReceiptOverlay, boundary/wallet's settled-notes rows, and
 * BetTicket's stake/gas/proof trio. */
export default function StatRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-6 border-b border-hairline py-3.5", className)}>
      <span className="text-[15px] text-smoke">{label}</span>
      <span className="font-mono text-sm text-bone text-right">{children}</span>
    </div>
  );
}
