import { campaign } from "../src/generator";
import { it, expect } from "vitest";
import { Game, CRASH_PENALTY } from "../src/game";
import { solveScore } from "../src/solver";
import { segmentClear, boundaryContact, type Point } from "../src/geometry";
import type { Track } from "../src/generator";
import { record, load, RECORDS_KEY, type Records } from "../src/storage";
function fixture(hole: Point[] = []): Track {
  const t: Track = {
    seed: "fixture",
    kind: "rally",
    difficulty: 1,
    width: 4,
    outer: [
      { x: 0, y: 0 },
      { x: 12, y: 0 },
      { x: 12, y: 8 },
      { x: 0, y: 8 },
    ],
    hole,
    center: [],
    nodes: [],
    edges: [],
    regions: [],
    start: 0,
    finish: 0,
    stages: 2,
    size: 12,
    fallback: false,
  };
  for (let y = 1; y < 8; y++)
    for (let x = 1; x < 12; x++)
      if (segmentClear({ x, y }, { x, y }, t.outer, hole)) {
        t.nodes.push({ x, y });
        t.regions.push(x >= 10 ? 1 : 0);
      }
  t.edges = t.nodes.map((a) =>
    t.nodes.flatMap((b, i) =>
      Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) === 1 &&
      segmentClear(a, b, t.outer, hole)
        ? [i]
        : [],
    ),
  );
  t.start = t.nodes.findIndex((p) => p.x === 2 && p.y === 4);
  t.finish = t.nodes.findIndex((p) => p.x === 10 && p.y === 4);
  return t;
}
it("długie proste w czterech kierunkach liczą się jako jedno kliknięcie", () => {
  for (const target of [
    { x: 10, y: 4 },
    { x: 1, y: 4 },
    { x: 2, y: 1 },
    { x: 2, y: 7 },
  ]) {
    const t = fixture(),
      g = new Game(t);
    g.select(t.nodes[t.start]);
    expect(g.select(target)).toBe("move");
    expect(g.segments).toBe(1);
    expect(g.length).toBeGreaterThanOrEqual(1);
  }
});
it("tylko jednokratkowe przekątne; niedozwolony kierunek nie jest wypadkiem", () => {
  const t = fixture(),
    g = new Game(t);
  g.select(t.nodes[t.start]);
  expect(g.select({ x: 4, y: 6 })).toBe("direction");
  expect(g.select({ x: 5, y: 5 })).toBe("direction");
  expect(g.penaltyPoints).toBe(0);
  expect(g.segments).toBe(0);
  expect(g.select({ x: 3, y: 5 })).toBe("move");
  expect(g.segments).toBe(1);
});
it("kontakt końcem, przejście przez bandę i dotknięcie wzdłuż bandy to wypadki", () => {
  const hole = [
    { x: 4, y: 3 },
    { x: 8, y: 3 },
    { x: 8, y: 5 },
    { x: 4, y: 5 },
  ];
  for (const [t, target] of [
    [fixture(), { x: 12, y: 4 }],
    [fixture(), { x: 15, y: 4 }],
    [fixture(hole), { x: 10, y: 4 }],
  ] as const) {
    const g = new Game(t);
    g.select(t.nodes[t.start]);
    expect(g.select(target)).toBe("crash");
    expect(g.penaltyPoints).toBe(-CRASH_PENALTY);
    expect(g.segments).toBe(0);
    expect(g.crashPoint).not.toBeNull();
    expect(g.select(target)).toBe("crashed");
    expect(g.penaltyPoints).toBe(-CRASH_PENALTY);
    g.undo();
    expect(g.crashed).toBe(true);
    g.clear();
    expect(g.crashed).toBe(false);
    expect(g.penaltyPoints).toBe(-CRASH_PENALTY);
  }
  expect(boundaryContact({ x: 2, y: 3 }, { x: 10, y: 3 }, [hole])).toEqual({
    x: 4,
    y: 3,
  });
  expect(
    segmentClear({ x: 2, y: 3 }, { x: 10, y: 3 }, fixture().outer, hole),
  ).toBe(false);
});
it("bramki są rozliczane po całej prostej, a cofnięcie usuwa cały segment", () => {
  const t = fixture();
  t.stages = 4;
  t.regions = t.nodes.map((p) =>
    p.x <= 3 ? 0 : p.x <= 5 ? 1 : p.x <= 7 ? 2 : 3,
  );
  const g = new Game(t);
  g.select(t.nodes[t.start]);
  expect(g.select({ x: 10, y: 4 })).toBe("move");
  expect(g.done).toBe(true);
  expect(g.stages).toEqual([0, 3]);
  g.undo();
  expect(g.segments).toBe(0);
  expect(g.stages).toEqual([0]);
  expect(g.done).toBe(false);
});
it("solver wylicza iloraz, a przekątnych nie skleja", () => {
  const t = fixture(),
    s = solveScore(t);
  expect(s.clicks).toBe(8);
  expect(s.path[0]).toBe(t.start);
  expect(s.path.at(-1)).toBe(t.finish);
  expect(s.score).toBe(1);
  const g = new Game(t);
  g.select(t.nodes[t.start]);
  for (const id of s.path.slice(1)) expect(g.select(t.nodes[id])).toBe("move");
  expect(g.done).toBe(true);
  const diag: Track = {
    ...t,
    nodes: [
      { x: 2, y: 2 },
      { x: 3, y: 3 },
      { x: 4, y: 4 },
    ],
    edges: [[1], [0, 2], [1]],
    regions: [0, 0, 1],
    start: 0,
    finish: 2,
  };
  expect(solveScore(diag).clicks).toBe(2);
});
it("nowe rekordy segmentowe są oddzielone od starych długości", () => {
  const m = new Map<string, string>();
  Object.assign(globalThis, {
    localStorage: {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => m.set(k, v),
    },
  });
  m.set("records", JSON.stringify({ tor: { length: 1 } }));
  record("tor", {
    score: 5,
    lengthSegments: 5,
    clicks: 1,
    stars: 3,
    level: 0,
    penaltyPoints: -5,
  });
  record("tor", {
    score: 6,
    lengthSegments: 6,
    clicks: 1,
    stars: 2,
    level: 0,
    penaltyPoints: 0,
  });
  expect(load<Records>(RECORDS_KEY, {}).tor.score).toBe(5);
  record("tor", {
    score: 5,
    lengthSegments: 5,
    clicks: 1,
    stars: 3,
    level: 0,
    penaltyPoints: 0,
  });
  expect(load<Records>(RECORDS_KEY, {}).tor.penaltyPoints).toBe(0);
});

it("wynik to iloraz długości jednostkowej i kliknięć, cofanie przelicza oba", () => {
  const t = fixture(),
    g = new Game(t);
  g.select(t.nodes[t.start]);
  expect(g.clicks).toBe(0);
  g.select({ x: 6, y: 4 });
  expect(g.lengthSegments).toBe(4);
  expect(g.clicks).toBe(1);
  expect(g.score).toBe(4);
  g.select({ x: 6, y: 6 });
  expect(g.lengthSegments).toBe(6);
  expect(g.clicks).toBe(2);
  expect(g.score).toBe(3);
  g.undo();
  expect(g.lengthSegments).toBe(4);
  expect(g.score).toBe(4);
});
it("iloraz nie używa starej optymalizacji iloczynu", () => {
  const base = fixture();
  const b = [
    { x: 1, y: 1 },
    { x: 1, y: 0 },
    { x: 1, y: -1 },
    { x: 1, y: -2 },
    { x: 2, y: -2 },
    { x: 3, y: -2 },
    { x: 4, y: -2 },
    { x: 5, y: -2 },
    { x: 5, y: -1 },
    { x: 5, y: 0 },
    { x: 5, y: 1 },
  ];
  const alternatives = [
    [
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
      { x: 5, y: 1 },
    ],
    [
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 3 },
      { x: 3, y: 3 },
      { x: 3, y: 2 },
      { x: 4, y: 2 },
      { x: 4, y: 1 },
      { x: 5, y: 1 },
    ],
  ];
  for (const [index, a] of alternatives.entries()) {
    const nodes: Point[] = [],
      edges: number[][] = [],
      lookup = new Map<string, number>();
    for (const route of [a, b]) {
      let last = -1;
      for (const p of route) {
        const key = `${p.x},${p.y}`;
        let id = lookup.get(key);
        if (id === undefined) {
          id = nodes.length;
          lookup.set(key, id);
          nodes.push(p);
          edges.push([]);
        }
        if (last >= 0) {
          edges[last].push(id);
          edges[id].push(last);
        }
        last = id;
      }
    }
    const finish = lookup.get("5,1")!,
      t = {
        ...base,
        nodes,
        edges,
        regions: nodes.map((_, i) => (i === finish ? 1 : 0)),
        start: 0,
        finish,
      };
    const s = solveScore(t);
    expect(s.score).toBe(1);
    expect(s.clicks).toBe(index === 0 ? 6 : 8);
    expect(s.lengthSegments).toBe(index === 0 ? 6 : 8);
  }
});

it("100 poziomów ma wykonalny przejazd jednostkowy z ilorazem 1 z długimi prostymi", () => {
  for (let level = 1; level <= 100; level++) {
    const t = campaign(level),
      s = solveScore(t),
      g = new Game(t);
    g.select(t.nodes[t.start]);
    for (const node of s.path.slice(1))
      expect(g.select(t.nodes[node])).toBe("move");
    expect(g.done).toBe(true);
    expect(g.score).toBe(s.score);
    expect(g.clicks).toBe(s.clicks);
  }
}, 120000);
