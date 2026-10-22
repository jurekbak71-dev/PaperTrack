import { describe, it, expect } from "vitest";
import { minimumWidth, validate } from "../src/generator/validate";
import { generate, campaign, type Kind } from "../src/generator";
import { segmentIn, distance } from "../src/geometry";
import { solve, complete } from "../src/solver";
import { Game } from "../src/game";
import { interpolate } from "../src/input";
import { record, load } from "../src/storage";
describe("geometria", () => {
  it("sprawdza cały odcinek, również przez dziurę", () => {
    const outer = [
        { x: 0, y: 0 },
        { x: 8, y: 0 },
        { x: 8, y: 8 },
        { x: 0, y: 8 },
      ],
      hole = [
        { x: 3, y: 3 },
        { x: 5, y: 3 },
        { x: 5, y: 5 },
        { x: 3, y: 5 },
      ];
    expect(segmentIn({ x: 2, y: 4 }, { x: 6, y: 4 }, outer, hole)).toBe(false);
    expect(segmentIn({ x: 1, y: 1 }, { x: 2, y: 2 }, outer, hole)).toBe(true);
  });
  it("liczy przekątne i uzupełnia osiem kierunków", () => {
    expect(distance({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe(Math.SQRT2);
    for (let y = -1; y <= 1; y++)
      for (let x = -1; x <= 1; x++)
        if (x || y)
          expect(
            interpolate({ x: 0, y: 0 }, { x: x * 5, y: y * 5 }),
          ).toHaveLength(5);
  });
  it("wyznacza rzeczywiste optimum na prostym grafie", () => {
    const t = generate("simple", "rally");
    t.nodes = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ];
    t.edges = [
      [1, 2],
      [0, 2],
      [0, 1],
    ];
    t.regions = [0, 0, 1];
    t.stages = 2;
    t.start = 0;
    t.finish = 2;
    expect(solve(t).length).toBe(Math.SQRT2);
  });
  it("pełne okrążenie, cofanie i odrzucanie skoków", () => {
    const t = generate("undo"),
      g = new Game(t),
      s = solve(t);
    expect(complete(t, t.start, 0)).toBe(false);
    expect(g.move(t.nodes.length + 1)).toBe(false);
    s.path.slice(1).forEach((n) => expect(g.move(n)).toBe(true));
    expect(g.done).toBe(true);
    expect(g.length).toBeCloseTo(s.length, 9);
    g.undo();
    expect(g.done).toBe(false);
    g.clear();
    expect(g.length).toBe(0);
    expect(g.path).toEqual([t.start]);
  });
  it("zapisuje tylko lepszy rekord", () => {
    const m = new Map();
    Object.assign(globalThis, {
      localStorage: {
        getItem: (k: string) => m.get(k) ?? null,
        setItem: (k: string, v: string) => m.set(k, v),
      },
    });
    record("a", 10, 3);
    record("a", 11, 2);
    expect(load<any>("records", {}).a.length).toBe(10);
  });
  it("deterministyczny seed", () =>
    expect(generate("fixed", "circuit")).toEqual(generate("fixed", "circuit")));
  it("100 poziomów kampanii jest przejezdnych", () => {
    for (let l = 1; l <= 100; l++)
      expect(solve(campaign(l)).path.length).toBeGreaterThan(2);
  }, 120000);
});
for (const kind of ["oval", "circuit", "rally"] as Kind[])
  it(`1000 seedów: ${kind}`, async () => {
    let fallbacks = 0;
    const forms = new Set<string>();
    for (let seed = 0; seed < 1000; seed++) {
      if (seed % 10 === 0)
        await new Promise((resolve) => setTimeout(resolve, 0));
      const t = generate(String(seed), kind, 1 + (seed % 5));
      fallbacks += Number(t.fallback);
      forms.add(JSON.stringify(t.outer));
      expect(t.width).toBeGreaterThanOrEqual(4);
      expect(minimumWidth(t)).toBeGreaterThanOrEqual(t.width - 1e-6);
      expect(validate(t)).toBe(true);
      expect(t.nodes.length).toBeGreaterThan(100);
      const s = solve(t);
      expect(s.length).toBeGreaterThan(0);
      const seen = new Set<number>([t.start]),
        q = [t.start];
      for (let i = 0; i < q.length; i++)
        for (const n of t.edges[q[i]])
          if (!seen.has(n)) {
            seen.add(n);
            q.push(n);
          }
      expect(seen.size).toBe(t.nodes.length);
      for (let j = 1; j < s.path.length; j++) {
        const a = t.nodes[s.path[j - 1]],
          b = t.nodes[s.path[j]];
        expect(segmentIn(a, b, t.outer, t.hole)).toBe(true);
        expect(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))).toBe(1);
      }
    }
    expect(fallbacks).toBeLessThan(20);
    expect(forms.size).toBeGreaterThan(950);
  }, 600000);
