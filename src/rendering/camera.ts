import type { Point } from "../geometry";
export function camera(
  width: number,
  height: number,
  size: number,
  zoom: number,
  pan: Point,
) {
  const cell = (width / size) * zoom;
  return {
    cell,
    x: width / 2 - (size / 2 - pan.x) * cell,
    y: height / 2 - (size / 2 - pan.y) * cell,
  };
}
export function nodeAt(
  x: number,
  y: number,
  view: ReturnType<typeof camera>,
): Point {
  return {
    x: Math.round((x - view.x) / view.cell),
    y: Math.round((y - view.y) / view.cell),
  };
}
