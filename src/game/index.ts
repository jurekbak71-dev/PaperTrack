import type { Track } from "../generator";
import { advance, complete } from "../solver";
import { distance, type Point } from "../geometry";
export const STAR_THRESHOLDS = [1.02, 1.1] as const;
export class Game {
  path: number[];
  stages: number[] = [0];
  length = 0;
  started = false;
  constructor(public track: Track) {
    this.path = [track.start];
  }
  get last() {
    return this.path.at(-1)!;
  }
  get done() {
    return (
      this.path.length > 1 &&
      complete(this.track, this.last, this.stages.at(-1)!)
    );
  }
  get choices() {
    if (!this.started || this.done) return [];
    return this.track.edges[this.last].filter(
      (next) => advance(this.track, this.last, next, this.stages.at(-1)!) >= 0,
    );
  }
  select(
    point: Point,
  ): "start" | "move" | "same" | "need-start" | "too-far" | "illegal" | "done" {
    if (this.done) return "done";
    const current = this.track.nodes[this.last];
    if (!this.started) {
      if (point.x !== current.x || point.y !== current.y) return "need-start";
      this.started = true;
      return "start";
    }
    const dx = Math.abs(point.x - current.x),
      dy = Math.abs(point.y - current.y);
    if (dx === 0 && dy === 0) return "same";
    if (Math.max(dx, dy) !== 1) return "too-far";
    const next = this.track.edges[this.last].find(
      (id) =>
        this.track.nodes[id].x === point.x &&
        this.track.nodes[id].y === point.y,
    );
    return next !== undefined && this.move(next) ? "move" : "illegal";
  }
  move(next: number) {
    if (this.done || !this.track.edges[this.last].includes(next)) return false;
    const stage = advance(this.track, this.last, next, this.stages.at(-1)!);
    if (stage < 0) return false;
    this.length += distance(
      this.track.nodes[this.last],
      this.track.nodes[next],
    );
    this.path.push(next);
    this.stages.push(stage);
    return true;
  }
  undo() {
    if (this.path.length < 2) return;
    const p = this.path.pop()!;
    this.stages.pop();
    this.length = Math.max(
      0,
      this.length - distance(this.track.nodes[p], this.track.nodes[this.last]),
    );
  }
  clear() {
    this.started = false;
    this.path = [this.track.start];
    this.stages = [0];
    this.length = 0;
  }
}
