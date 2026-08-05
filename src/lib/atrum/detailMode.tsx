"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type DetailMode = "simple" | "detailed";

const STORAGE_KEY = "atrum:detail-mode";

interface Value {
  mode: DetailMode;
  setMode: (mode: DetailMode) => void;
  toggle: () => void;
}

const Ctx = createContext<Value | null>(null);

/**
 * A density switch, not a mode switch to a different app: every page renders the same
 * components regardless of this value, `<Detail>` panels just default open or closed. Default is
 * "simple" on every render (including the server) so there is no hydration mismatch; the real
 * stored preference is applied in an effect right after mount.
 */
export function DetailModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<DetailMode>("simple");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "simple" || stored === "detailed") setModeState(stored);
  }, []);

  const setMode = (next: DetailMode) => {
    setModeState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  const value: Value = {
    mode,
    setMode,
    toggle: () => setMode(mode === "simple" ? "detailed" : "simple"),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDetailMode(): Value {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDetailMode must be used within a DetailModeProvider");
  return ctx;
}
