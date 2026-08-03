import { color, ANONYMITY_FLOOR, GRAFT_BATCH_SIZE } from "./theme";

export interface Tick {
  height: string;
  color: string;
}

/** Header strip — 28 bars, filled proportionally to how full the anonymity set is. */
export function headTicks(anonymitySet: number, ok: boolean, count = 28): Tick[] {
  const filled = Math.round(Math.min(anonymitySet, GRAFT_BATCH_SIZE) / GRAFT_BATCH_SIZE * count);
  return Array.from({ length: count }, (_, i) => ({
    height: `${6 + (i % 3) * 4}px`,
    color: i < filled ? (ok ? color.pewter : color.ember) : color.slate,
  }));
}

/** Market page anonymity panel — one bar per note up to the graft batch size, floor marked. */
export function setTicks(anonymitySet: number, ok: boolean, count = GRAFT_BATCH_SIZE): Tick[] {
  return Array.from({ length: count }, (_, i) => ({
    height: i < anonymitySet ? "40px" : i === ANONYMITY_FLOOR - 1 ? "16px" : "8px",
    color:
      i < anonymitySet ? (ok ? color.ivory : color.ember) : i === ANONYMITY_FLOOR - 1 ? color.ash : color.slate,
  }));
}

/** Refusal card — how far short of the floor the set currently is. */
export function refusalTicks(anonymitySet: number, count = ANONYMITY_FLOOR): Tick[] {
  return Array.from({ length: count }, (_, i) => ({
    height: i < anonymitySet ? "24px" : "8px",
    color: i < anonymitySet ? color.ember : color.slate,
  }));
}

/** Boundary page deposit queue — position of "your" note among a batch. */
export function queueTicks(positionAhead: number, count = GRAFT_BATCH_SIZE): Tick[] {
  return Array.from({ length: count }, (_, i) => ({
    height: i === positionAhead ? "24px" : i < positionAhead ? "16px" : "8px",
    color: i === positionAhead ? color.ivory : i < positionAhead ? color.ash : color.slate,
  }));
}
