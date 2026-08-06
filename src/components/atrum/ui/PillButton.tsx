import { cn } from "@/lib/utils";

/**
 * The denomination/side selector button repeated across the wallet's amount rungs, BetTicket's
 * YES/NO sides, and the spendable-note picker. Sane defaults match the rung/note-picker look;
 * pass `selectedClassName`/`unselectedClassName` to override per side (e.g. BetTicket's YES vs.
 * NO accent colors).
 */
export default function PillButton({
  selected,
  onClick,
  disabled,
  children,
  className,
  selectedClassName = "bg-ivory text-void border-ivory",
  unselectedClassName = "bg-transparent text-pewter border-hairline",
}: {
  selected: boolean;
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
  selectedClassName?: string;
  unselectedClassName?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "cursor-pointer border font-mono text-sm transition-colors duration-control ease-control disabled:cursor-not-allowed disabled:opacity-50",
        selected ? selectedClassName : unselectedClassName,
        className,
      )}
    >
      {children}
    </button>
  );
}
