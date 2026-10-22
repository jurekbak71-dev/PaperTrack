import type { Point } from "../geometry";
/** Rasterize a fast pointer movement without skipping any grid neighbours. */
export function interpolate(a: Point, b: Point): Point[] {
  const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  return Array.from({ length: steps }, (_, i) => ({
    x: Math.round(a.x + ((b.x - a.x) * (i + 1)) / steps),
    y: Math.round(a.y + ((b.y - a.y) * (i + 1)) / steps),
  }));
}
