import { it, expect } from "vitest";
import { camera, nodeAt } from "../src/rendering/camera";
it("prostokątna plansza ma kwadratowe kratki i poprawne trafianie po przybliżeniu i przesunięciu", () => {
  for (const [width, height] of [
    [640, 250],
    [510, 210],
    [720, 720],
  ])
    for (const cell of [28, 36, 56]) {
      const view = camera(width, height, 52, (cell * 52) / width, {
        x: 20,
        y: -8,
      });
      expect(view.cell).toBeCloseTo(cell);
      for (const p of [
        { x: 6, y: 34 },
        { x: 7, y: 35 },
      ])
        expect(nodeAt(view.x + p.x * cell, view.y + p.y * cell, view)).toEqual(
          p,
        );
      expect(nodeAt(width / 2, height / 2, view)).toEqual({ x: 6, y: 34 });
    }
});
