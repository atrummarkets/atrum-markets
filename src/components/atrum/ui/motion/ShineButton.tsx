/**
 * Ported from Magic UI's Shiny Button technique, restyled to a gold sweep instead of the
 * library's default white one -- stays under the "<1% of surface" halo rule since it's a thin
 * transient band, not a fill. Reuses the `atrum-shimmer-sweep` keyframe `Shimmer.tsx` already
 * defines in `globals.css` at a slower duration, rather than adding a near-duplicate keyframe.
 * Purely presentational, same split as `CardGlow`/`BorderBeam`: the caller marks its own element
 * `position: relative; overflow: hidden` and renders this as a child. Native CSS `animation`, so
 * it's automatically covered by the global `prefers-reduced-motion` rule -- no JS gate needed.
 *
 * Reserved for the app's highest-intent primary actions (place bet, deposit, unlock access) --
 * not `PillButton` rungs or secondary links, where a shine on every clickable element would
 * cheapen the one place it should read as "this is the important button."
 */
export default function ShineButton({ active = true }: { active?: boolean }) {
  if (!active) return null;
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 animate-[atrum-shimmer-sweep_3000ms_ease-in-out_infinite] bg-gradient-to-r from-transparent via-halo/25 to-transparent"
    />
  );
}
