import type { Point } from "../geometry";
export const SCORE_RULES = {
  diagonalLength: 1 as number,
  countStartClick: false,
};
export const segmentLength = (a: Point, b: Point) =>
  a.x !== b.x && a.y !== b.y
    ? SCORE_RULES.diagonalLength
    : Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const scoreOf = (length: number, clicks: number) =>
  length * (clicks + (SCORE_RULES.countStartClick ? 1 : 0));
