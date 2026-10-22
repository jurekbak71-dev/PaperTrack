import { it, expect } from "vitest";
import { campaign } from "../src/generator";
import { startArrow } from "../src/rendering";
import { inside, boundaryContact } from "../src/geometry";
it("pojedyncza strzałka jest obok toru i pokazuje kierunek osi na wszystkich 100 poziomach", () => {
  for (let level = 1; level <= 100; level++) {
    const t = campaign(level),
      { from, to } = startArrow(t),
      a = t.center[0],
      b = t.center[1];
    expect(
      (to.x - from.x) * (b.x - a.x) + (to.y - from.y) * (b.y - a.y),
    ).toBeGreaterThan(0);
    for (const p of [from, to]) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(t.size);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(t.size);
      expect(inside(p, t.outer) && !(t.hole.length && inside(p, t.hole))).toBe(
        false,
      );
    }
    expect(boundaryContact(from, to, [t.outer, t.hole])).toBeNull();
  }
}, 120000);
