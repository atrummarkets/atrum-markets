"use client";

import { useEffect, useRef, useState } from "react";

const LOAD_LINES = [
  "Casting the monolith",
  "Binding the oracles",
  "Veiling the book",
  "Opening the vault",
];

function pad3(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(3, "0");
}

export default function BootOverlay() {
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [prog, setProg] = useState(0);
  const progRef = useRef(0);

  useEffect(() => {
    const load = setInterval(() => {
      const next = Math.min(100, progRef.current + 2 + Math.random() * 5);
      progRef.current = next;
      setProg(next);
      if (next >= 100) {
        clearInterval(load);
        setTimeout(() => setOpening(true), 260);
        setTimeout(() => setLoading(false), 1560);
      }
    }, 60);
    return () => clearInterval(load);
  }, []);

  if (!loading) return null;

  const doorL = opening ? "translateX(-101%)" : "translateX(0)";
  const doorR = opening ? "translateX(101%)" : "translateX(0)";
  const seamH = opening ? "100vh" : `${prog * 0.66}vh`;
  const seamOp = opening ? 0.15 : 1;
  const uiOp = opening ? 0 : 1;
  const loadLine = opening
    ? "The doors open"
    : LOAD_LINES[Math.min(3, Math.floor(prog / 26))];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 90, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: "50.15%",
          background: "linear-gradient(90deg,#080A0C 58%,#0C0E11)",
          transform: doorL,
          transition: "transform 1.05s cubic-bezier(.72,0,.2,1)",
          willChange: "transform",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          right: 0,
          width: "50.15%",
          background: "linear-gradient(270deg,#080A0C 58%,#0C0E11)",
          transform: doorR,
          transition: "transform 1.05s cubic-bezier(.72,0,.2,1)",
          willChange: "transform",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 1,
          height: seamH,
          transform: "translate(-50%,-50%)",
          background:
            "linear-gradient(180deg,transparent,rgba(255,245,216,.85) 18%,#FFFFFF 50%,rgba(255,245,216,.85) 82%,transparent)",
          boxShadow: "0 0 20px rgba(255,245,216,.7), 0 0 60px rgba(255,245,216,.28)",
          opacity: seamOp,
          transition: "height .22s linear, opacity .9s ease",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          opacity: uiOp,
          transition: "opacity .45s ease",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/uploads/atrum-logo.png"
          alt="ATRUM"
          style={{ width: 96, height: 96, objectFit: "contain", opacity: 0.9 }}
        />
        <div
          style={{
            fontFamily: "var(--font-barlow-condensed)",
            fontWeight: 600,
            fontSize: 58,
            lineHeight: 1,
            letterSpacing: ".02em",
            color: "#F7F2E8",
          }}
        >
          {pad3(prog)}
        </div>
        <div
          style={{
            fontFamily: "var(--font-manrope)",
            fontWeight: 500,
            fontSize: 11,
            letterSpacing: ".26em",
            color: "#6E7276",
            textTransform: "uppercase",
          }}
        >
          {loadLine}
        </div>
      </div>
    </div>
  );
}
