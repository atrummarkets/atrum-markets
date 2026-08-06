/**
 * Hand-built SVG line, same posture as CountdownBar/CardGlow -- no charting library. Renders an
 * honest empty/short state below ~3 points rather than drawing a line that implies a trend from
 * almost nothing: `ActivityOverlay` already established the rule that this app never shows a
 * signal stronger than what's actually known, and a 2-point sparkline is exactly that kind of
 * overclaim.
 */
export default function Sparkline({
  points,
  width = 160,
  height = 32,
  className,
}: {
  points: number[];
  width?: number;
  height?: number;
  className?: string;
}) {
  if (points.length < 3) {
    return (
      <div className={className} style={{ height, display: "flex", alignItems: "center" }}>
        <span className="text-[11px] text-ash">Not enough history yet</span>
      </div>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const pad = 2;

  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - pad - ((p - min) / range) * (height - pad * 2);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Trend over the last ${points.length} readings, from ${min} to ${max}`}
    >
      <path d={d} fill="none" stroke="#F0D9B0" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
