import type { Track } from "../generator";
import { advance, complete } from "../solver";
import { distance } from "../geometry";
export const STAR_THRESHOLDS = [1.02, 1.1] as const;
export class Game {
  path: number[];
  stages: number[] = [0];
  length = 0;
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
    this.path = [this.track.start];
    this.stages = [0];
    this.length = 0;
  }
}
