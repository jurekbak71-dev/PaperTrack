export type Point = { x: number; y: number };
export const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y);
export const cross = (a: Point, b: Point) => a.x * b.y - a.y * b.x;
export const sub = (a: Point, b: Point): Point => ({
  x: a.x - b.x,
  y: a.y - b.y,
});
export function inside(p: Point, poly: Point[]) {
  let yes = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (
      Math.abs(cross(sub(p, a), sub(b, a))) < 1e-8 &&
      p.x >= Math.min(a.x, b.x) - 1e-8 &&
      p.x <= Math.max(a.x, b.x) + 1e-8 &&
      p.y >= Math.min(a.y, b.y) - 1e-8 &&
      p.y <= Math.max(a.y, b.y) + 1e-8
    )
      return true;
    if (
      a.y > p.y != b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    )
      yes = !yes;
  }
  return yes;
}
export function segmentIn(a: Point, b: Point, outer: Point[], hole: Point[]) {
  if (a.x === b.x && a.y === b.y)
    return inside(a, outer) && (!hole.length || !inside(a, hole));
  const ts = [0, 1];
  const d = sub(b, a);
  for (const poly of [outer, hole])
    for (let i = 0; i < poly.length; i++) {
      const c = poly[i],
        e = sub(poly[(i + 1) % poly.length], c),
        den = cross(d, e);
      if (Math.abs(den) < 1e-10) continue;
      const t = cross(sub(c, a), e) / den,
        u = cross(sub(c, a), d) / den;
      if (t > 0 && t < 1 && u >= 0 && u <= 1) ts.push(t);
    }
  ts.sort((x, y) => x - y);
  const valid = (t: number) => {
    const p = { x: a.x + d.x * t, y: a.y + d.y * t };
    return inside(p, outer) && (!hole.length || !inside(p, hole));
  };
  return (
    valid(0) && valid(1) && ts.slice(1).every((t, i) => valid((t + ts[i]) / 2))
  );
}
