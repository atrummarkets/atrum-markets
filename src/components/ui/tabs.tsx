"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

/**
 * Used as a segmented control (List + Trigger only, no TabsContent) for the Simple/Detailed
 * header toggle -- the thing that changes on selection is global detail-mode context, not a
 * panel scoped under this component, but Tabs still gives correct role="tablist" and arrow-key
 * behavior for free.
 */
const Tabs = TabsPrimitive.Root;

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn("inline-flex items-center gap-1 rounded border border-hairline p-0.5", className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "rounded px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-smoke transition-colors",
        "data-[state=active]:bg-ivory data-[state=active]:text-void",
        "outline-none focus-visible:ring-1 focus-visible:ring-hairlineStrong",
        className,
      )}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger };
