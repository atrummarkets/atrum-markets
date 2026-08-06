"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { useMarket } from "@/lib/atrum/marketContext";
import { useWallet } from "@/lib/atrum/wallet";
import { Dialog, AtrumDialogContent } from "@/components/atrum/ui/Dialog";
import { DialogTitle } from "@/components/ui/dialog";
import { NAV } from "@/components/atrum/Sidebar";

/**
 * `cmdk` is headless -- ships zero CSS -- so every visual here is hand-written against the same
 * tokens the rest of the app uses, same posture as depending on Radix for Dialog/Tabs/Tooltip.
 * Opens on Cmd/Ctrl+K or the Sidebar's "Search" row (via the `atrum:open-command-palette` event,
 * which decouples the two -- Sidebar doesn't need to know this component exists to trigger it).
 * Read/navigate only: the Admin group deep-links into AdminPanel rather than running
 * resolve/settle itself, keeping destructive actions button-gated where they already are.
 */
export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { markets, config } = useMarket();
  const { session } = useWallet();

  const isOperator = !!session && !!config?.operator && session.toLowerCase() === config.operator.toLowerCase();

  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    function onOpenEvent() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKeydown);
    window.addEventListener("atrum:open-command-palette", onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKeydown);
      window.removeEventListener("atrum:open-command-palette", onOpenEvent);
    };
  }, []);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  const itemClass =
    "flex cursor-pointer items-center justify-between gap-4 px-4 py-2.5 text-[13px] text-bone outline-none data-[selected=true]:bg-graphite";
  const heading = (label: string) => (
    <span className="px-4 pb-1 pt-3 text-[11px] uppercase tracking-[0.16em] text-ash">{label}</span>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <AtrumDialogContent className="items-start justify-center pt-32" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <Command
          className="w-full max-w-[560px] border border-hairlineStrong bg-basalt"
          shouldFilter
          loop
        >
          <Command.Input
            autoFocus
            placeholder="Search markets, or jump to a page…"
            className="w-full border-b border-hairline bg-transparent px-4 py-3.5 font-mono text-sm text-bone outline-none placeholder:text-ash"
          />
          <Command.List className="max-h-[420px] overflow-y-auto py-2">
            <Command.Empty className="px-4 py-6 text-sm text-ash">No results.</Command.Empty>

            <Command.Group heading={heading("Markets")}>
              {markets.slice(0, 50).map((m) => (
                <Command.Item
                  key={m.marketId}
                  value={`${m.question} ${m.category}`}
                  onSelect={() => go(`/market/${m.marketId}`)}
                  className={itemClass}
                >
                  <span className="truncate">{m.question}</span>
                  <span className="shrink-0 font-mono text-xs text-ash">{m.category}</span>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading={heading("Go to")}>
              {NAV.map((item) => (
                <Command.Item key={item.href} value={item.label} onSelect={() => go(item.href)} className={itemClass}>
                  <span>{item.label}</span>
                </Command.Item>
              ))}
            </Command.Group>

            {isOperator && (
              <Command.Group heading={heading("Admin")}>
                <Command.Item value="operator markets" onSelect={() => go("/markets")} className={itemClass}>
                  <span>Review resolvable markets</span>
                </Command.Item>
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </AtrumDialogContent>
    </Dialog>
  );
}
