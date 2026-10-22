import { segmentLength, scoreOf, SCORE_RULES } from "./scoring";
import type { Track } from "../generator";
import { advance, complete } from "../solver";
import { distance, boundaryContact, inside, type Point } from "../geometry";
export const STAR_THRESHOLDS = [1.02, 1.1] as const;
export const CRASH_PENALTY = 5;
export class Game {
  path: number[];
  stages: number[] = [0];
  length = 0;
  lengthSegments = 0;
  started = false;
  crashed = false;
  crashPoint: Point | null = null;
  private lookup: Map<string, number>;
  constructor(
    public track: Track,
    public penaltyPoints = 0,
  ) {
    this.path = [track.start];
    this.lookup = new Map(track.nodes.map((p, i) => [`${p.x},${p.y}`, i]));
  }
  get last() {
    return this.path.at(-1)!;
  }
  get segments() {
    return this.path.length - 1;
  }
  get clicks() {
    return (
      this.segments + (this.started && SCORE_RULES.countStartClick ? 1 : 0)
    );
  }
  get score() {
    return scoreOf(this.lengthSegments, this.segments);
  }
  get done() {
    return (
      !this.crashed &&
      this.segments > 0 &&
      complete(this.track, this.last, this.stages.at(-1)!)
    );
  }
  select(
    point: Point,
  ):
    | "start"
    | "move"
    | "same"
    | "need-start"
    | "direction"
    | "illegal"
    | "done"
    | "crash"
    | "crashed" {
    if (this.crashed) return "crashed";
    if (this.done) return "done";
    const current = this.track.nodes[this.last];
    if (!this.started) {
      if (point.x !== current.x || point.y !== current.y) return "need-start";
      this.started = true;
      return "start";
    }
    const dx = Math.abs(point.x - current.x),
      dy = Math.abs(point.y - current.y);
    if (!dx && !dy) return "same";
    if (
      !Number.isInteger(point.x) ||
      !Number.isInteger(point.y) ||
      (dx && dy && (dx !== 1 || dy !== 1))
    )
      return "direction";
    const contact = boundaryContact(current, point, [
      this.track.outer,
      this.track.hole,
    ]);
    if (
      contact ||
      !inside(point, this.track.outer) ||
      (this.track.hole.length && inside(point, this.track.hole))
    ) {
      this.crashed = true;
      this.crashPoint = contact ?? point;
      this.penaltyPoints -= CRASH_PENALTY;
      return "crash";
    }
    let node = this.last,
      stage = this.stages.at(-1)!;
    const steps = Math.max(dx, dy),
      sx = Math.sign(point.x - current.x),
      sy = Math.sign(point.y - current.y);
    for (let i = 1; i <= steps; i++) {
      const next = this.lookup.get(
        `${current.x + i * sx},${current.y + i * sy}`,
      );
      if (next === undefined || !this.track.edges[node].includes(next))
        return "illegal";
      stage = advance(this.track, node, next, stage);
      if (stage < 0) return "illegal";
      node = next;
    }
    this.length += distance(current, point);
    this.lengthSegments += segmentLength(current, point);
    this.path.push(node);
    this.stages.push(stage);
    return "move";
  }
  fork(): Game {
    const copy = Object.assign(Object.create(Game.prototype) as Game, this);
    copy.path = [...this.path];
    copy.stages = [...this.stages];
    return copy;
  }
  move(next: number) {
    if (!this.track.nodes[next]) return false;
    // Retain the low-level traversal API, while applying the same collision rules.
    this.started = true;
    return this.select(this.track.nodes[next]) === "move";
  }
  undo() {
    if (this.crashed || this.path.length < 2) return;
    const p = this.path.pop()!;
    this.stages.pop();
    this.lengthSegments = Math.max(
      0,
      this.lengthSegments -
        segmentLength(this.track.nodes[p], this.track.nodes[this.last]),
    );
    this.length = Math.max(
      0,
      this.length - distance(this.track.nodes[p], this.track.nodes[this.last]),
    );
  }
  clear() {
    this.started = false;
    this.crashed = false;
    this.crashPoint = null;
    this.path = [this.track.start];
    this.stages = [0];
    this.length = 0;
    this.lengthSegments = 0;
  }
}
