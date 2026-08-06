import { cn } from "@/lib/utils";

/** The 11px uppercase/0.16em-tracked chip repeated across every page's section headers. */
export default function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("text-[11px] uppercase tracking-[0.16em] text-ash", className)}>
      {children}
    </span>
  );
}
