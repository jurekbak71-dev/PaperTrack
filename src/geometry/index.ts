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

/** Earliest boundary contact, including a tangent, an endpoint and collinear overlap. */
export function boundaryContact(
  a: Point,
  b: Point,
  polygons: Point[][],
): Point | null {
  const d = sub(b, a),
    squared = d.x * d.x + d.y * d.y;
  let first = Infinity;
  for (const polygon of polygons)
    for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i],
        q = polygon[(i + 1) % polygon.length],
        e = sub(q, p),
        den = cross(d, e);
      if (squared < 1e-16) {
        if (
          Math.abs(cross(sub(a, p), e)) < 1e-8 &&
          a.x >= Math.min(p.x, q.x) - 1e-8 &&
          a.x <= Math.max(p.x, q.x) + 1e-8 &&
          a.y >= Math.min(p.y, q.y) - 1e-8 &&
          a.y <= Math.max(p.y, q.y) + 1e-8
        )
          first = 0;
      } else if (Math.abs(den) > 1e-10) {
        const t = cross(sub(p, a), e) / den,
          u = cross(sub(p, a), d) / den;
        if (t >= -1e-8 && t <= 1 + 1e-8 && u >= -1e-8 && u <= 1 + 1e-8)
          first = Math.min(first, Math.max(0, Math.min(1, t)));
      } else if (Math.abs(cross(sub(p, a), d)) < 1e-8) {
        const t1 = ((p.x - a.x) * d.x + (p.y - a.y) * d.y) / squared,
          t2 = ((q.x - a.x) * d.x + (q.y - a.y) * d.y) / squared;
        if (Math.max(t1, t2) >= -1e-8 && Math.min(t1, t2) <= 1 + 1e-8)
          first = Math.min(first, Math.max(0, Math.min(t1, t2)));
      }
    }
  return Number.isFinite(first)
    ? { x: a.x + first * d.x, y: a.y + first * d.y }
    : null;
}
export function segmentClear(
  a: Point,
  b: Point,
  outer: Point[],
  hole: Point[],
) {
  return (
    segmentIn(a, b, outer, hole) &&
    boundaryContact(a, b, [outer, hole]) === null
  );
}

export const samePoint = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) < 1e-8 && Math.abs(a.y - b.y) < 1e-8;
export function segmentIntersection(
  a: Point,
  b: Point,
  c: Point,
  d: Point,
): { kind: "point"; point: Point } | { kind: "overlap" } | null {
  const r = sub(b, a),
    s = sub(d, c),
    rr = r.x * r.x + r.y * r.y,
    ss = s.x * s.x + s.y * s.y,
    den = cross(r, s),
    q = sub(c, a);
  if (rr < 1e-12) {
    if (ss < 1e-12) return samePoint(a, c) ? { kind: "point", point: a } : null;
    const u = ((a.x - c.x) * s.x + (a.y - c.y) * s.y) / ss;
    return Math.abs(cross(sub(a, c), s)) < 1e-8 && u >= -1e-8 && u <= 1 + 1e-8
      ? { kind: "point", point: a }
      : null;
  }
  if (ss < 1e-12) return segmentIntersection(c, d, a, b);
  if (Math.abs(den) > 1e-10) {
    const t = cross(q, s) / den,
      u = cross(q, r) / den;
    return t >= -1e-8 && t <= 1 + 1e-8 && u >= -1e-8 && u <= 1 + 1e-8
      ? { kind: "point", point: { x: a.x + t * r.x, y: a.y + t * r.y } }
      : null;
  }
  if (Math.abs(cross(q, r)) > 1e-8) return null;
  const t1 = (q.x * r.x + q.y * r.y) / rr,
    t2 = ((d.x - a.x) * r.x + (d.y - a.y) * r.y) / rr,
    lo = Math.max(0, Math.min(t1, t2)),
    hi = Math.min(1, Math.max(t1, t2));
  if (hi < lo - 1e-8) return null;
  return hi - lo > 1e-8
    ? { kind: "overlap" }
    : { kind: "point", point: { x: a.x + lo * r.x, y: a.y + lo * r.y } };
}
