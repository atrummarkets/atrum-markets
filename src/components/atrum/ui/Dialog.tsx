"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * The full-bleed "ceremony" dialog shell shared by ActivityOverlay, ReceiptOverlay and
 * WithdrawDialog -- same void-plus-radial-gradient backdrop those three already used as plain
 * divs, now with a real focus trap, Escape handling and aria-modal from Radix underneath.
 */
export { Dialog };

export function AtrumDialogContent({
  className,
  children,
  onEscapeKeyDown,
  /** Default is the full-bleed opaque void ActivityOverlay/ReceiptOverlay use. WithdrawDialog
   * overrides this to a translucent scrim instead -- it's a modal over the portfolio page, not
   * a full-screen replacement of it. */
  overlayClassName,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { overlayClassName?: string }) {
  return (
    <DialogPortal>
      <DialogOverlay
        className={overlayClassName}
        style={{
          backgroundImage:
            "radial-gradient(90% 55% at 50% 0%, rgba(240,217,176,0.06) 0%, rgba(6,7,10,0) 62%)",
        }}
      />
      <DialogPrimitive.Content
        onEscapeKeyDown={onEscapeKeyDown}
        className={cn("fixed inset-0 z-40 flex items-center justify-center p-16 outline-none", className)}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}
