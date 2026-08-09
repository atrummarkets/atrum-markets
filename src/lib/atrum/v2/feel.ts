"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The non-visual half of "this should feel like a vault door closing".
 *
 * Two sounds, both synthesised rather than loaded: a low `thunk` for anything irreversible
 * (committing a bet, sealing, crossing the deposit threshold) and a short `tick` for
 * transitions. Synthesised because a 40-byte oscillator beats shipping audio files for two
 * cues, and because the pitch envelope is the sound -- 72Hz sliding to 38Hz is what makes the
 * thunk read as weight rather than a beep.
 */

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

export interface Sounds {
  /** Weight. Irreversible things only -- overuse turns it into a notification chime. */
  thunk: () => void;
  /** A transition landed. */
  tick: (freq?: number) => void;
}

export function useSounds(enabled = true): Sounds {
  // Lazily constructed: browsers refuse to start an AudioContext before a user gesture, so
  // building one at mount would leave a suspended context and log a warning on every load.
  const ctxRef = useRef<AudioContext | null>(null);

  const context = useCallback((): AudioContext | null => {
    if (!enabled) return null;
    try {
      type WithWebkit = typeof globalThis & { webkitAudioContext?: typeof AudioContext };
      const Ctor = window.AudioContext ?? (window as WithWebkit).webkitAudioContext;
      if (!Ctor) return null;
      ctxRef.current ??= new Ctor();
      return ctxRef.current;
    } catch {
      // Audio is a garnish. Never let it break an action.
      return null;
    }
  }, [enabled]);

  const thunk = useCallback(() => {
    const ac = context();
    if (!ac) return;
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(72, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.32);
    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.45);
  }, [context]);

  const tick = useCallback(
    (freq = 620) => {
      const ac = context();
      if (!ac) return;
      const t = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(t);
      osc.stop(t + 0.14);
    },
    [context],
  );

  useEffect(() => () => void ctxRef.current?.close().catch(() => {}), []);

  return { thunk, tick };
}

/**
 * Text dissolving into ciphertext, character by character.
 *
 * Used when a note is sealed and when a win is claimed. The point is that the plaintext is
 * visibly destroyed rather than fading out -- it becomes something else, and what it becomes
 * is not reversible.
 */
export function scramble(plain: string, ratio: number): string {
  const hex = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < plain.length; i++) {
    out += i / plain.length < ratio ? hex[Math.floor(Math.random() * 16)] : plain[i];
  }
  return out;
}

export function randomCipher(length: number): string {
  const hex = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < length; i++) out += hex[Math.floor(Math.random() * 16)];
  return out;
}
