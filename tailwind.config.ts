import type { Config } from "tailwindcss";
import { color, font, motion } from "./src/lib/atrum/theme";

/**
 * `theme.ts` stays the single source of truth. This file only re-projects it into Tailwind's
 * theme so `bg-ivory` and `color.ivory` never drift apart -- see the "Visual system & UI
 * libraries" section of the revamp plan.
 */
function splitMotionToken(token: string): { duration: string; ease: string } {
  const [duration, ...easeParts] = token.split(" ");
  return { duration, ease: easeParts.join(" ") };
}

const durations: Record<string, string> = {};
const eases: Record<string, string> = {};
for (const [name, token] of Object.entries(motion)) {
  const { duration, ease } = splitMotionToken(token);
  durations[name] = duration;
  eases[name] = ease;
}

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { ...color },
      fontFamily: {
        wordmark: [font.wordmark],
        display: [font.display],
        body: [font.body],
        mono: [font.mono],
      },
      borderRadius: {
        DEFAULT: "2px",
        none: "0px",
        full: "9999px",
      },
      transitionDuration: durations,
      transitionTimingFunction: eases,
    },
  },
  plugins: [],
};

export default config;
