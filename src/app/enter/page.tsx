"use client";

import { useState } from "react";
import Logo from "@/components/atrum/Logo";
import { color, font } from "@/lib/atrum/theme";
import ShineButton from "@/components/atrum/ui/motion/ShineButton";

/**
 * Standalone on purpose -- NOT under src/app/(product)/, whose layout mounts
 * WalletProvider/MarketProvider. Those fetch gated resources (e.g. /api/atrum/config)
 * on mount, which would 401 before this page has had a chance to pass the gate.
 */
export default function Enter() {
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!code || pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/atrum/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "That code isn't valid.");

      // Hard navigation, not router.push: guarantees the fresh Set-Cookie is
      // present on the very next request, so proxy.ts re-evaluates cleanly.
      const next = new URLSearchParams(window.location.search).get("next") || "/start";
      window.location.href = next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code isn't valid.");
      setPending(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: color.void,
        color: color.bone,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 64,
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 480, width: "100%" }}>
        <div style={{ marginBottom: 32 }}>
          <Logo size={30} />
        </div>
        <h1
          style={{
            fontFamily: font.display,
            fontWeight: 400,
            fontSize: "clamp(28px,5vw,44px)",
            lineHeight: 1,
            letterSpacing: "0.02em",
            color: color.ivory,
            margin: "0 0 16px",
          }}
        >
          Testnet is invite-only.
        </h1>
        <p style={{ fontSize: 16, color: color.smoke, margin: "0 0 32px" }}>
          Enter the access code from your waitlist confirmation.
        </p>
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}
        >
          <label htmlFor="access-code" style={{ position: "absolute", left: -9999 }}>
            Access code
          </label>
          <input
            id="access-code"
            type="text"
            required
            autoFocus
            placeholder="AC-XXXX-XXXX-XXXX-XXXX"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{
              flex: 1,
              minWidth: 240,
              padding: "16px 20px",
              background: color.basalt,
              border: `1px solid ${color.hairlineStrong}`,
              borderRadius: 2,
              color: color.bone,
              fontFamily: font.mono,
              fontSize: 16,
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={pending}
            className="atrum-cta"
            style={{
              position: "relative",
              overflow: "hidden",
              padding: "16px 32px",
              border: `1px solid ${color.hairlineStrong}`,
              color: color.bone,
              borderRadius: 2,
              background: "transparent",
              fontFamily: font.display,
              fontSize: 16,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              cursor: pending ? "default" : "pointer",
              opacity: pending ? 0.7 : 1,
            }}
          >
            <ShineButton active={!pending} />
            {pending ? "Checking…" : "Enter"}
          </button>
        </form>
        {error && (
          <p style={{ fontSize: 14, color: color.ember, marginTop: 20 }}>{error}</p>
        )}
      </div>
    </div>
  );
}
