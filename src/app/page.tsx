import Link from "next/link";
import BootOverlay from "@/components/BootOverlay";
import Logo from "@/components/atrum/Logo";
import { color, font } from "@/lib/atrum/theme";
import Spotlight from "@/components/atrum/ui/motion/Spotlight";

export default function Home() {
  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        background: color.void,
        color: color.bone,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 64,
      }}
    >
      {/* Ambient breathing, not a reveal -- the door-opening below is this page's one reveal, this
          just replaces what used to be a static radial gradient with a slowly living one. */}
      <Spotlight />

      <BootOverlay />

      {/* The doors opening are this page's one reveal — no second entrance animation stacked on top. */}
      <div style={{ position: "relative", textAlign: "center", maxWidth: 640 }}>
        <div style={{ marginBottom: 32 }}>
          <Logo size={30} />
        </div>
        <h1
          style={{
            fontFamily: font.display,
            fontWeight: 400,
            fontSize: "clamp(40px,7vw,88px)",
            lineHeight: 0.98,
            letterSpacing: "0.02em",
            color: color.ivory,
            margin: "0 0 24px",
          }}
        >
          Welcome to Atrum.
        </h1>
        <p style={{ fontSize: 20, color: color.smoke, margin: "0 0 48px" }}>
          The odds are public. You are not.
        </p>
        <Link
          href="/start"
          className="atrum-cta"
          style={{
            display: "inline-block",
            padding: "20px 40px",
            border: `1px solid ${color.hairlineStrong}`,
            color: color.bone,
            borderRadius: 2,
            fontFamily: font.display,
            fontSize: 20,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          }}
        >
          Enter the room
        </Link>

        {/* The table the light falls on. */}
        <div style={{ width: 96, height: 1, background: color.hairlineStrong, margin: "96px auto 0" }} />
      </div>
    </div>
  );
}
