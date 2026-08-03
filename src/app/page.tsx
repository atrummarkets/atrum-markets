import Link from "next/link";
import BootOverlay from "@/components/BootOverlay";
import { color, font } from "@/lib/atrum/theme";

export default function Home() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: color.void,
        backgroundImage:
          "radial-gradient(120% 62% at 50% -18%, rgba(240,217,176,0.055) 0%, rgba(240,217,176,0.014) 34%, rgba(6,7,10,0) 66%)",
        color: color.bone,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 64,
      }}
    >
      <BootOverlay />

      {/* The doors opening are this page's one reveal — no second entrance animation stacked on top. */}
      <div style={{ textAlign: "center", maxWidth: 640 }}>
        <div
          style={{
            fontFamily: font.wordmark,
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: "0.16em",
            color: color.ash,
            marginBottom: 32,
            textTransform: "uppercase",
          }}
        >
          Atrum
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
          href="/markets"
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
