import { cross, sub, distance, type Point } from "../geometry";
import type { Track } from "./index";
const pointSegment = (p: Point, a: Point, b: Point) => {
  const d = sub(b, a),
    q = sub(p, a),
    t = Math.max(
      0,
      Math.min(1, (q.x * d.x + q.y * d.y) / (d.x * d.x + d.y * d.y)),
    );
  return distance(p, { x: a.x + t * d.x, y: a.y + t * d.y });
};
function intersects(a: Point, b: Point, c: Point, d: Point) {
  const ab = sub(b, a),
    cd = sub(d, c),
    den = cross(ab, cd);
  if (Math.abs(den) < 1e-9) return false;
  const t = cross(sub(c, a), cd) / den,
    u = cross(sub(c, a), ab) / den;
  return t > 1e-8 && t < 1 - 1e-8 && u > 1e-8 && u < 1 - 1e-8;
}
export function minimumWidth(t: Track) {
  if (!t.hole.length) {
    let min = Infinity;
    const n = t.center.length;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n - 1; j++)
        min = Math.min(
          min,
          pointSegment(
            t.outer[i],
            t.outer[2 * n - 1 - j],
            t.outer[2 * n - 2 - j],
          ),
        );
    return min;
  }
  let min = Infinity;
  for (const p of t.outer)
    for (let j = 0; j < t.hole.length; j++)
      min = Math.min(
        min,
        pointSegment(p, t.hole[j], t.hole[(j + 1) % t.hole.length]),
      );
  for (const p of t.hole)
    for (let j = 0; j < t.outer.length; j++)
      min = Math.min(
        min,
        pointSegment(p, t.outer[j], t.outer[(j + 1) % t.outer.length]),
      );
  return min;
}
export function validate(t: Track) {
  for (const poly of [t.outer, t.hole])
    for (let i = 0; i < poly.length; i++)
      for (let j = i + 2; j < poly.length; j++) {
        if (i === 0 && j === poly.length - 1) continue;
        if (
          intersects(
            poly[i],
            poly[(i + 1) % poly.length],
            poly[j],
            poly[(j + 1) % poly.length],
          )
        )
          throw Error("Przecięcie granic");
      }
  if (minimumWidth(t) < t.width - 1e-6) throw Error("Zbyt wąski tor");
  const seen = new Set([t.start]),
    queue = [t.start];
  for (let i = 0; i < queue.length; i++)
    for (const n of t.edges[queue[i]])
      if (!seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
  if (seen.size !== t.nodes.length) throw Error("Odizolowana nawierzchnia");
  return true;
}
