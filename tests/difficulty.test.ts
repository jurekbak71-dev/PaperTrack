import { it, expect } from "vitest";
import { campaign, generate } from "../src/generator";
import { Game } from "../src/game";
import { boundaryContact, inside } from "../src/geometry";
import { solve } from "../src/solver";
it("trudność 10: maksymalnie dwie kratki, same przekątne, pełny legalny przejazd", () => {
  for (const kind of ["oval", "circuit", "rally"] as const)
    for (let seed = 0; seed < 20; seed++) {
      const t = generate("diagonal-" + seed, kind, 10),
        g = new Game(t);
      expect(t.width).toBeLessThanOrEqual(2);
      g.select(t.nodes[t.start]);
      const p = t.nodes[t.start];
      expect(g.select({ x: p.x + 1, y: p.y })).toBe("direction");
      for (const id of solve(t).path.slice(1)) {
        const a = t.nodes[g.last],
          b = t.nodes[id];
        expect(Math.abs(a.x - b.x)).toBe(1);
        expect(Math.abs(a.y - b.y)).toBe(1);
        expect(g.select(b)).toBe("move");
      }
      expect(g.done).toBe(true);
      expect(g.score).toBe(1);
    }
}, 120000);
it("przeszkody rosną z trudnością, graf omija całe wysepki i ściany", () => {
  for (let d = 1; d <= 10; d++) {
    const t = campaign(d * 10);
    expect(t.difficulty).toBe(d);
    expect(t.obstacles?.length).toBe(d < 3 ? 0 : Math.floor(d / 2));
    for (const poly of t.obstacles ?? [])
      for (let i = 0; i < t.nodes.length; i++) {
        expect(inside(t.nodes[i], poly)).toBe(false);
        for (const j of t.edges[i])
          expect(boundaryContact(t.nodes[i], t.nodes[j], [poly])).toBeNull();
      }
  }
}, 120000);
it("dotknięcie przeszkody jest wypadkiem z karą", () => {
  const t = generate("obstacle", "rally", 4),
    poly = t.obstacles![0],
    g = new Game(t);
  // Isolate the obstacle boundary check from checkpoint/direction validation.
  const p = poly[0];
  t.start = t.nodes.findIndex((n) => n.y === Math.round(p.y) && n.x < p.x);
  g.path = [t.start];
  g.started = true;
  const a = t.nodes[t.start];
  expect(g.select({ x: Math.ceil(poly[1].x), y: a.y })).toBe("crash");
  expect(g.penaltyPoints).toBe(-5);
});
