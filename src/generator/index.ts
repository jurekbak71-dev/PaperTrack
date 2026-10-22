import { validate } from "./validate";
import { solve } from "../solver";
import {
  distance,
  boundaryContact,
  inside,
  segmentClear as segmentIn,
  type Point,
} from "../geometry";
export const TRACK_WIDTH_SCALE = 0.9;
export const defaultWidth = (difficulty: number) =>
  [6.3, 5.4, 4.8, 4.3, 3.8, 3.4, 3, 2.6, 2.25, 1.9][difficulty - 1];
export type Kind = "oval" | "circuit" | "rally";
export type Track = {
  seed: string;
  kind: Kind;
  difficulty: number;
  width: number;
  outer: Point[];
  hole: Point[];
  center: Point[];
  gates?: Point[];
  obstacles?: Point[][];
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
  width = defaultWidth(difficulty),
): Track {
  if (!Number.isFinite(width) || width < 1.8 || width > 8)
    throw Error("Szerokość musi wynosić 1,8–8 kratek");
  const r = random(seed),
    size = 52,
    center: Point[] = [],
    outer: Point[] = [],
    hole: Point[] = [];
  const shapeDifficulty = Math.ceil(difficulty / 2);
  const stages =
    kind === "rally"
      ? difficulty === 10
        ? 12
        : 4 + difficulty * 2
      : 6 + difficulty * 2;
  if (kind === "rally") {
    const amplitude = 0.7 + shapeDifficulty * 0.55,
      phase = r() * 6.28;
    const ys: number[] = [];
    for (let x = 5; x <= 47; x++)
      ys.push(
        26 +
          amplitude *
            Math.sin(
              ((x - 5) / 42) * Math.PI * (2 + Math.floor(shapeDifficulty / 2)) +
                phase,
            ),
      );
    // Vertical cross-sections are widened by the maximum slope: normal width >= requested width.
    const slope =
      (amplitude * Math.PI * (2 + Math.floor(shapeDifficulty / 2))) / 42;
    const half =
      (width / 2) * Math.sqrt(1 + slope * slope) +
      (difficulty === 10 ? 0 : 0.25 * TRACK_WIDTH_SCALE);
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
    const half = width / 2 + (difficulty === 10 ? 0 : 0.35 * TRACK_WIDTH_SCALE);
    for (let i = 0; i < 128; i++) {
      const t = (i / 128) * Math.PI * 2;
      const bend =
        kind === "circuit"
          ? (0.65 + shapeDifficulty * 0.22) * Math.sin(3 * t + phase)
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
    if (kind === "circuit" && shapeDifficulty >= 3) {
      center.length = 0;
      const notch = 24 + r() * (shapeDifficulty >= 4 ? 5 : 3),
        vertices =
          shapeDifficulty >= 4
            ? [
                { x: 9, y: 5 },
                { x: 43, y: 5 },
                { x: 43, y: 47 },
                { x: 9, y: 47 },
                { x: 9, y: 39 },
                { x: notch, y: 39 },
                { x: notch, y: 31 },
                { x: 9, y: 31 },
                { x: 9, y: 23 },
                { x: notch - 2, y: 23 },
                { x: notch - 2, y: 15 },
                { x: 9, y: 15 },
              ]
            : [
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
  if (difficulty === 10) {
    const extent = 9 + Math.floor(r() * 3),
      notch = 1 + Math.floor(r() * 5),
      upper = 5 + Math.floor(r() * 2),
      lower = -5 - Math.floor(r() * 2);
    const shiftX = Math.floor(r() * 3) - 1,
      shiftY = Math.floor(r() * 3) - 1;
    const vertices =
      kind === "rally"
        ? [
            { x: 5, y: 20 },
            { x: 11, y: 26 },
            { x: 17, y: 20 },
            { x: 23, y: 26 },
            { x: 29, y: 20 },
            { x: 35, y: 26 },
            { x: 41, y: 20 },
            { x: 47, y: 26 },
          ]
        : [
            [-10, -10],
            [10, -10],
            [10, 10],
            [-10, 10],
            [-10, 6],
            [3, 6],
            [3, 2],
            [-10, 2],
            [-10, -2],
            [3, -2],
            [3, -6],
            [-10, -6],
          ].map(([u, v]) => {
            u = u === -10 ? -extent : u === 10 ? extent : u === 3 ? notch : u;
            v =
              v === -10
                ? -extent
                : v === 10
                  ? extent
                  : v === 6
                    ? upper
                    : v === -6
                      ? lower
                      : v;
            return { x: 26 + u + v + shiftX, y: 26 + u - v + shiftY };
          });
    if (kind === "rally") {
      vertices.length = 0;
      let x = 4,
        y = 20 + Math.floor(r() * 4);
      vertices.push({ x, y });
      for (let i = 0; i < 7; i++) {
        const length = 5 + Math.floor(r() * 2);
        x += length;
        y += (i % 2 ? -1 : 1) * length;
        vertices.push({ x, y });
      }
    }
    // Rotate/reflection keeps integer diagonal vertices while varying the seed.
    if (r() > 0.5)
      vertices.forEach((p) => {
        p.y = 52 - p.y;
      });
    center.length = 0;
    outer.length = 0;
    hole.length = 0;
    const closed = kind !== "rally",
      count = vertices.length;
    const offsets = vertices.map((p, i) => {
      const a = vertices[i === 0 ? (closed ? count - 1 : 0) : i - 1],
        b = vertices[i === count - 1 ? (closed ? 0 : i) : i + 1];
      let u = { x: p.x - a.x, y: p.y - a.y },
        v = { x: b.x - p.x, y: b.y - p.y };
      if (!u.x && !u.y) u = { ...v };
      if (!v.x && !v.y) v = { ...u };
      const il = Math.hypot(u.x, u.y),
        ol = Math.hypot(v.x, v.y);
      u = { x: u.y / il, y: -u.x / il };
      v = { x: v.y / ol, y: -v.x / ol };
      const f = width / 2 / (1 + u.x * v.x + u.y * v.y);
      return { x: (u.x + v.x) * f, y: (u.y + v.y) * f };
    });
    const left: Point[] = [],
      right: Point[] = [];
    for (let i = 0; i < (closed ? count : count - 1); i++) {
      const a = vertices[i],
        j = (i + 1) % count,
        b = vertices[j],
        n = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) * 2;
      for (let k = 0; k < n; k++) {
        const f = k / n,
          p = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f },
          o = {
            x: offsets[i].x + (offsets[j].x - offsets[i].x) * f,
            y: offsets[i].y + (offsets[j].y - offsets[i].y) * f,
          };
        center.push(p);
        left.push({ x: p.x + o.x, y: p.y + o.y });
        right.push({ x: p.x - o.x, y: p.y - o.y });
      }
    }
    if (!closed) {
      const p = vertices.at(-1)!,
        o = offsets.at(-1)!;
      center.push(p);
      left.push({ x: p.x + o.x, y: p.y + o.y });
      right.push({ x: p.x - o.x, y: p.y - o.y });
    }
    outer.push(...left);
    if (closed) hole.push(...right);
    else outer.push(...right.reverse());
    // Depending on winding, the larger polygon is the outside boundary.
    if (closed && !inside(center[0], outer)) {
      const tmp = [...outer];
      outer.length = 0;
      outer.push(...hole);
      hole.length = 0;
      hole.push(...tmp);
    }
  }
  if (kind !== "rally" && r() > 0.5) {
    center.reverse();
  }
  const axis = center
    .slice(0, kind === "rally" ? -1 : undefined)
    .map((a, i) => {
      const b = center[(i + 1) % center.length],
        dx = b.x - a.x,
        dy = b.y - a.y,
        length = Math.hypot(dx, dy);
      return { a, b, dx, dy, length, squared: length * length, offset: 0 };
    });
  let total = 0;
  for (const segment of axis) {
    segment.offset = total;
    total += segment.length;
  }
  const gates = Array.from({ length: stages - 1 }, (_, i) => {
    const fraction = kind === "rally" ? (i + 1) / stages : (i + 0.5) / stages,
      d = total * fraction;
    const segment = axis.find((s) => s.offset + s.length >= d) ?? axis.at(-1)!,
      ratio = (d - segment.offset) / segment.length;
    return {
      x: segment.a.x + segment.dx * ratio,
      y: segment.a.y + segment.dy * ratio,
    };
  });
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
      let progress = 0,
        best = Infinity;
      for (const segment of axis) {
        const ratio = Math.max(
          0,
          Math.min(
            1,
            ((p.x - segment.a.x) * segment.dx +
              (p.y - segment.a.y) * segment.dy) /
              segment.squared,
          ),
        );
        const dx = p.x - segment.a.x - ratio * segment.dx,
          dy = p.y - segment.a.y - ratio * segment.dy,
          d = dx * dx + dy * dy;
        if (d < best) {
          best = d;
          progress = (segment.offset + ratio * segment.length) / total;
        }
      }
      const phase = kind === "rally" ? progress : (progress + 0.5 / stages) % 1;
      regions.push(Math.min(stages - 1, Math.floor(phase * stages)));
    }
  nodes.forEach(() => edges.push([]));
  nodes.forEach((p, i) => {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dy) || (difficulty === 10 && (!dx || !dy))) continue;
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
  const track: Track = {
    seed,
    kind,
    difficulty,
    width,
    outer,
    hole,
    center,
    gates,
    nodes,
    edges,
    regions,
    start,
    finish,
    stages,
    size,
    fallback: false,
    obstacles: [],
  };
  retainConnected(track);
  if (difficulty >= 3) addObstacles(track, r);
  return track;
}
export function generate(
  seed: string,
  kind: Kind = "oval",
  difficulty = 1,
  width = defaultWidth(difficulty),
): Track {
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 10)
    throw Error("Trudność 1–10");
  if (difficulty === 10 && width > 2)
    throw Error("Trudność 10: maksymalnie 2 kratki");
  if (!Number.isFinite(width) || width < 1.8 || width > 8)
    throw Error("Szerokość 1,8–8");
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
  const t = candidate("bezpieczny-wariant-v3", kind, difficulty, width);
  t.seed = seed;
  t.difficulty = difficulty;
  t.fallback = true;
  validate(t);
  solve(t);
  return t;
}
export function campaign(level: number) {
  if (!Number.isInteger(level) || level < 1 || level > 100)
    throw Error("Poziom 1–100");
  const difficulty = Math.ceil(level / 10);
  const width = defaultWidth(difficulty);
  return generate(
    `kampania-v3-${level}`,
    level <= 10 ? "oval" : level % 3 === 0 ? "rally" : "circuit",
    difficulty,
    width,
  );
}

/** At diagonal-only difficulty the grid has two parity components. Keep the
 * start component; never render unreachable legal nodes or place starts there. */
function retainConnected(t: Track) {
  const seen = new Set([t.start]),
    queue = [t.start];
  for (let i = 0; i < queue.length; i++)
    for (const j of t.edges[queue[i]])
      if (!seen.has(j)) {
        seen.add(j);
        queue.push(j);
      }
  if (!seen.has(t.finish)) throw Error("Odcięta meta");
  const ids = [...seen].sort((a, b) => a - b),
    remap = new Map(ids.map((id, i) => [id, i]));
  t.nodes = ids.map((i) => t.nodes[i]);
  t.regions = ids.map((i) => t.regions[i]);
  t.edges = ids.map((i) =>
    t.edges[i].filter((j) => seen.has(j)).map((j) => remap.get(j)!),
  );
  t.start = remap.get(t.start)!;
  t.finish = remap.get(t.finish)!;
}
function addObstacles(t: Track, rng: () => number) {
  const route = solve(t).path.map((i) => t.nodes[i]);
  const count = Math.floor(t.difficulty / 2);
  for (
    let attempt = 0;
    attempt < 100 && t.obstacles!.length < count;
    attempt++
  ) {
    const base = t.nodes[Math.floor(rng() * t.nodes.length)];
    const p = t.difficulty === 10 ? { x: base.x + 0.65, y: base.y } : base;
    if (distance(p, t.nodes[t.start]) < 3 || distance(p, t.nodes[t.finish]) < 3)
      continue;
    const wall = t.obstacles!.length % 2 === 1,
      hx = t.difficulty === 10 ? 0.13 : wall ? 0.65 : 0.28,
      hy = t.difficulty === 10 ? 0.13 : 0.28;
    const poly = [
      { x: p.x - hx, y: p.y - hy },
      { x: p.x + hx, y: p.y - hy },
      { x: p.x + hx, y: p.y + hy },
      { x: p.x - hx, y: p.y + hy },
    ];
    if (poly.some((q) => !segmentIn(q, q, t.outer, t.hole))) continue;
    if (
      t.obstacles!.some(
        (o) => boundaryContact(poly[0], poly[2], [o]) || inside(p, o),
      )
    )
      continue;
    if (
      route.some(
        (q, i) =>
          inside(q, poly) ||
          (i > 0 && boundaryContact(route[i - 1], q, [poly])),
      )
    )
      continue;
    t.obstacles!.push(poly);
    t.edges = t.edges.map((edges, i) =>
      inside(t.nodes[i], poly)
        ? []
        : edges.filter(
            (j) =>
              !inside(t.nodes[j], poly) &&
              !boundaryContact(t.nodes[i], t.nodes[j], [poly]),
          ),
    );
  }
  retainConnected(t);
}
