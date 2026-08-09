import type { Metadata } from "next";
import { WalletProvider } from "@/lib/atrum/wallet";
import { MarketProvider } from "@/lib/atrum/marketContext";
import { DetailModeProvider } from "@/lib/atrum/detailMode";
import Shell from "@/components/v2/Shell";

/**
 * v2 lives at its own route while it is built.
 *
 * Both interfaces run on one deployment, against the same providers and the same live pool, so
 * they can be compared side by side on real data. Replacing v1 outright would mean no fallback
 * if something is wrong mid-demo, which is a bad trade for a product that is currently being
 * shown to people.
 *
 * Its own providers rather than the (product) group's: v2 deliberately does not inherit that
 * shell's sidebar, ticker and command palette, and nesting to reuse the providers would drag
 * all of it in.
 */
export const metadata: Metadata = {
  title: "Atrum — Markets",
};

export default function V2Layout({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      <MarketProvider>
        <DetailModeProvider>
          <Shell>{children}</Shell>
        </DetailModeProvider>
      </MarketProvider>
    </WalletProvider>
  );
}
