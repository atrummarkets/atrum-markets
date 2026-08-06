"use client";

/**
 * Adapted from OriginKit's Fluid Trail technique (Interactive Elements), reduced down to a
 * single low-opacity gold trail instead of the library's fuller multi-point effect -- stays
 * under the "<1% of surface" gold-accent rule `theme.ts` sets for halo. Purely presentational,
 * same split as `BorderBeam`/`Shimmer`: the caller owns the `group` class and writes
 * `--spot-x`/`--spot-y` via its own `onMouseMove`, this just paints the gradient off those vars.
 */
export default function CardGlow() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-control ease-control group-hover:opacity-100"
      style={{
        background:
          "radial-gradient(240px circle at var(--spot-x, 50%) var(--spot-y, 50%), rgba(240,217,176,0.10), transparent 70%)",
      }}
    />
  );
}
