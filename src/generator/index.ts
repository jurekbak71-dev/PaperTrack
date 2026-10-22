import { validate } from "./validate";
import { solve } from "../solver";
import { distance, segmentClear as segmentIn, type Point } from "../geometry";
export type Kind = "oval" | "circuit" | "rally";
export type Track = {
  seed: string;
  kind: Kind;
  difficulty: number;
  width: number;
  outer: Point[];
  hole: Point[];
  center: Point[];
  nodes: Point[];
  edges: number[][];
  regions: number[];
  start: number;
  finish: number;
  stages: number;
  size: number;
  fallback: boolean;
};
export function random(seed: string) {
  let s = 2166136261;
  for (const c of seed) s = Math.imul(s ^ c.charCodeAt(0), 16777619);
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function candidate(
  seed: string,
  kind: Kind = "oval",
  difficulty = 1,
  width = Math.max(4, 7 - Math.floor(difficulty / 2)),
): Track {
  if (!Number.isFinite(width) || width < 4 || width > 8)
    throw Error("Szerokość musi wynosić 4–8 kratek");
  const r = random(seed),
    size = 52,
    center: Point[] = [],
    outer: Point[] = [],
    hole: Point[] = [];
  const stages = kind === "rally" ? 8 : 12;
  if (kind === "rally") {
    const amplitude = 1 + difficulty * 0.42,
      phase = r() * 6.28;
    const ys: number[] = [];
    for (let x = 5; x <= 47; x++)
      ys.push(
        26 +
          amplitude *
            Math.sin(
              ((x - 5) / 42) * Math.PI * (2 + Math.floor(difficulty / 2)) +
                phase,
            ),
      );
    // Vertical cross-sections are widened by the maximum slope: normal width >= requested width.
    const slope = (amplitude * Math.PI * (2 + Math.floor(difficulty / 2))) / 42;
    const half = (width / 2) * Math.sqrt(1 + slope * slope) + 0.25;
    for (let i = 0; i < ys.length; i++) {
      center.push({ x: 5 + i, y: ys[i] });
      outer.push({ x: 5 + i, y: ys[i] - half });
    }
    for (let i = ys.length - 1; i >= 0; i--)
      outer.push({ x: 5 + i, y: ys[i] + half });
  } else {
    const rx = 16 + r() * 2,
      ry = kind === "oval" ? 10 + r() * 2 : 13 + r(),
      phase = r() * 6.28;
    const half = width / 2 + 0.35;
    for (let i = 0; i < 128; i++) {
      const t = (i / 128) * Math.PI * 2;
      const bend =
        kind === "circuit"
          ? (0.65 + difficulty * 0.22) * Math.sin(3 * t + phase)
          : 0;
      const p = {
        x:
          26 +
          (kind === "oval"
            ? (rx - ry) * Math.sign(Math.cos(t)) + ry * Math.cos(t)
            : (rx + bend) * Math.cos(t)),
        y: 26 + (ry + bend) * Math.sin(t),
      };
      center.push(p);
    }
    if (kind === "circuit" && difficulty >= 3) {
      center.length = 0;
      const notch = 24 + r() * 3,
        vertices = [
          { x: 9, y: 9 },
          { x: 43, y: 9 },
          { x: 43, y: 43 },
          { x: 9, y: 43 },
          { x: 9, y: 30 },
          { x: notch, y: 30 },
          { x: notch, y: 22 },
          { x: 9, y: 22 },
        ],
        radius = 3.85;
      for (let j = 0; j < vertices.length; j++) {
        const p = vertices[j],
          a = vertices[(j + vertices.length - 1) % vertices.length],
          b = vertices[(j + 1) % vertices.length];
        const il = distance(a, p),
          ol = distance(p, b),
          u = { x: (p.x - a.x) / il, y: (p.y - a.y) / il },
          v = { x: (b.x - p.x) / ol, y: (b.y - p.y) / ol },
          c = {
            x: p.x - u.x * radius + v.x * radius,
            y: p.y - u.y * radius + v.y * radius,
          };
        const angle = Math.atan2(-v.y, -v.x),
          turn = u.x * v.y - u.y * v.x;
        for (let k = 0; k <= 12; k++) {
          const t = angle + (((Math.sign(turn) * Math.PI) / 2) * k) / 12;
          center.push({
            x: c.x + radius * Math.cos(t),
            y: c.y + radius * Math.sin(t),
          });
        }
      }
    }
    for (let i = 0; i < center.length; i++) {
      const p = center[i],
        a = center[(i + center.length - 1) % center.length],
        b = center[(i + 1) % center.length],
        dx = b.x - a.x,
        dy = b.y - a.y,
        len = Math.hypot(dx, dy);
      outer.push({ x: p.x + (dy / len) * half, y: p.y - (dx / len) * half });
      hole.push({ x: p.x - (dy / len) * half, y: p.y + (dx / len) * half });
    }
  }
  if (kind !== "rally" && r() > 0.5) {
    center.reverse();
  }
  const nodes: Point[] = [],
    edges: number[][] = [],
    regions: number[] = [],
    map = new Map<string, number>();
  for (let y = 0; y <= size; y++)
    for (let x = 0; x <= size; x++) {
      const p = { x, y };
      if (!segmentIn(p, p, outer, hole)) continue;
      map.set(`${x},${y}`, nodes.length);
      nodes.push(p);
      let nearest = 0,
        best = Infinity;
      center.forEach((c, i) => {
        const d = distance(c, p);
        if (d < best) {
          nearest = i;
          best = d;
        }
      });
      regions.push(
        Math.min(stages - 1, Math.floor((nearest / center.length) * stages)),
      );
    }
  nodes.forEach(() => edges.push([]));
  nodes.forEach((p, i) => {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const j = map.get(`${p.x + dx},${p.y + dy}`);
        if (j !== undefined && j > i && segmentIn(p, nodes[j], outer, hole)) {
          edges[i].push(j);
          edges[j].push(i);
        }
      }
  });
  edges.forEach((e) => e.sort((a, b) => a - b));
  const near = (p: Point) =>
    nodes.reduce(
      (a, n, i) => (distance(n, p) < distance(nodes[a], p) ? i : a),
      0,
    );
  const start = near(center[0]),
    finish = kind === "rally" ? near(center.at(-1)!) : start;
  return {
    seed,
    kind,
    difficulty,
    width,
    outer,
    hole,
    center,
    nodes,
    edges,
    regions,
    start,
    finish,
    stages,
    size,
    fallback: false,
  };
}
export function generate(
  seed: string,
  kind: Kind = "oval",
  difficulty = 1,
  width = Math.max(4, 7 - Math.floor(difficulty / 2)),
): Track {
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5)
    throw Error("Trudność 1–5");
  if (!Number.isFinite(width) || width < 4 || width > 8)
    throw Error("Szerokość 4–8");
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const t = candidate(
        attempt ? `${seed}:próba${attempt}` : seed,
        kind,
        difficulty,
        width,
      );
      t.seed = seed;
      validate(t);
      solve(t);
      return t;
    } catch {
      /* bounded retry with a deterministic alternative */
    }
  }
  const t = candidate("bezpieczny-wariant-v1", kind, 1, width);
  t.seed = seed;
  t.difficulty = difficulty;
  t.fallback = true;
  validate(t);
  solve(t);
  return t;
}
export const campaign = (level: number) =>
  generate(
    `kampania-v1-${level}`,
    level <= 10 ? "oval" : level % 3 === 0 ? "rally" : "circuit",
    level <= 10 ? 1 : level <= 25 ? 2 : level <= 50 ? 3 : level <= 75 ? 4 : 5,
  );
