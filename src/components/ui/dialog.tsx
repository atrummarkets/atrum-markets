"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

/**
 * shadcn's Dialog shape, restyled void/basalt/hairline -- adopted for the focus trap, Escape
 * handling, and aria-modal that ActivityOverlay/ReceiptOverlay/WithdrawDialog previously did
 * without. Atrum's overlays are full-bleed, not a dimmed backdrop over visible content, so the
 * overlay itself is opaque `void`, not the usual translucent scrim.
 */
const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;
const DialogPortal = DialogPrimitive.Portal;

function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return <DialogPrimitive.Overlay className={cn("fixed inset-0 z-40 bg-void", className)} {...props} />;
}

/**
 * No `forceMount` here -- Radix mounts/unmounts on `open` itself. Where a page wants a Framer
 * Motion exit animation (ActivityOverlay/ReceiptOverlay), it wraps this in its own
 * `AnimatePresence` + `forceMount` at the call site rather than baking that into the primitive.
 */
function DialogContent({
  className,
  children,
  showClose = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { showClose?: boolean }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn("fixed inset-0 z-40 flex items-center justify-center p-16 outline-none", className)}
        {...props}
      >
        {children}
        {showClose && (
          <DialogPrimitive.Close
            aria-label="Close"
            className="absolute right-8 top-8 text-ash hover:text-bone text-lg leading-none"
          >
            ×
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("font-display text-ivory", className)} {...props} />;
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("text-smoke", className)} {...props} />;
}

export { Dialog, DialogTrigger, DialogClose, DialogPortal, DialogOverlay, DialogContent, DialogTitle, DialogDescription };
