import type { Metadata } from "next";
import { color, font } from "@/lib/atrum/theme";
import { MarketProvider } from "@/lib/atrum/marketContext";
import Header from "@/components/atrum/Header";
import ProvingOverlay from "@/components/atrum/ProvingOverlay";
import SealedOverlay from "@/components/atrum/SealedOverlay";

export const metadata: Metadata = {
  title: "ATRUM — Market",
};

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return (
    <MarketProvider>
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
        <Header />
        {children}
      </div>
      <ProvingOverlay />
      <SealedOverlay />
    </MarketProvider>
  );
}
