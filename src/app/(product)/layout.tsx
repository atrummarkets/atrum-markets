import type { Metadata } from "next";
import { color, font } from "@/lib/atrum/theme";
import { WalletProvider } from "@/lib/atrum/wallet";
import { MarketProvider } from "@/lib/atrum/marketContext";
import { DetailModeProvider } from "@/lib/atrum/detailMode";
import { TooltipProvider } from "@/components/ui/tooltip";
import HeaderTicker from "@/components/atrum/HeaderTicker";
import Sidebar from "@/components/atrum/Sidebar";
import Footer from "@/components/atrum/Footer";
import ActivityOverlay from "@/components/atrum/ActivityOverlay";
import ReceiptOverlay from "@/components/atrum/ReceiptOverlay";
import CommandPalette from "@/components/atrum/CommandPalette";
import OnboardingBanner from "@/components/atrum/onboarding/OnboardingBanner";
import PageTransition from "@/components/atrum/PageTransition";

export const metadata: Metadata = {
  title: "Atrum — Markets",
};

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      <MarketProvider>
        <DetailModeProvider>
          <TooltipProvider delayDuration={150}>
            <div
              style={{
                minHeight: "100vh",
                background: color.void,
                backgroundImage:
                  "radial-gradient(120% 62% at 50% -18%, rgba(240,217,176,0.055) 0%, rgba(240,217,176,0.014) 34%, rgba(6,7,10,0) 66%)",
                color: color.bone,
                fontFamily: font.body,
                fontSize: 17,
                letterSpacing: "-0.005em",
                lineHeight: 1.5,
              }}
            >
              <HeaderTicker />
              <Sidebar />
              <div className="pt-8 md:ml-60">
                <OnboardingBanner />
                <PageTransition>{children}</PageTransition>
                <Footer />
              </div>
            </div>
            <CommandPalette />
            <ActivityOverlay />
            <ReceiptOverlay />
          </TooltipProvider>
        </DetailModeProvider>
      </MarketProvider>
    </WalletProvider>
  );
}
