"use client";

import { useEffect, useState } from "react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { useDetailMode } from "@/lib/atrum/detailMode";
import { cn } from "@/lib/utils";

/**
 * Wraps an explainer block that already exists elsewhere in the app (AnonymityPanel's body, the
 * market page's relayer/proof/payout tiles, a note's protocol-accurate state sentence). Opens by
 * default when the global Detail mode is "detailed"; closes when it's "simple" -- but the user
 * can still expand this one panel without flipping the global switch. Flipping the global switch
 * again resets every `<Detail>` on screen to match it.
 */
export default function Detail({
  summary,
  children,
  className,
}: {
  summary: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { mode } = useDetailMode();
  const [open, setOpen] = useState(mode === "detailed");

  useEffect(() => setOpen(mode === "detailed"), [mode]);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={className}>
      <CollapsibleTrigger
        className={cn(
          "flex w-full cursor-pointer items-center justify-between gap-4 py-3 text-left text-sm text-smoke",
          "transition-colors duration-control ease-control hover:text-bone",
        )}
      >
        <span>{summary}</span>
        <span
          aria-hidden
          className={cn("font-mono text-ash transition-transform duration-control ease-control", open && "rotate-90")}
        >
          ›
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent
        className={cn(
          "overflow-hidden",
          "data-[state=open]:animate-[atrum-collapsible-down_260ms_cubic-bezier(0.65,0,0.35,1)]",
          "data-[state=closed]:animate-[atrum-collapsible-up_260ms_cubic-bezier(0.65,0,0.35,1)]",
        )}
      >
        <div className="pb-5">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
