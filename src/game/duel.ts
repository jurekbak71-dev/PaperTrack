import { Game } from "./index";
import { advance, complete, solve } from "../solver";
import {
  distance,
  samePoint,
  segmentIntersection,
  type Point,
} from "../geometry";
import { random, type Track } from "../generator";
export const ILLEGAL_PENALTY = 1;
export type Side = "player" | "opponent";
export type Winner = Side | "draw" | null;
type Reverse = { x: number; y: number; limit: number };
type Snapshot = {
  player: Game;
  opponent: Game;
  reverse: Record<Side, Reverse | null>;
  turn: Side;
  winner: Winner;
  reason: string;
  moves: number;
};
export type DuelResult =
  | ReturnType<Game["select"]>
  | "turn"
  | "crossing"
  | "reverse"
  | "bounce"
  | "finished";
export function opponentTrack(t: Track): Track {
  const candidates = t.nodes
    .map((_, i) => i)
    .filter((i) => i !== t.start && t.regions[i] === t.regions[t.start])
    .sort(
      (a, b) =>
        distance(t.nodes[a], t.nodes[t.start]) -
          distance(t.nodes[b], t.nodes[t.start]) || a - b,
    );
  for (const start of candidates.slice(0, 12)) {
    const finish =
      t.kind === "rally"
        ? t.nodes
            .map((_, i) => i)
            .filter(
              (i) => i !== t.finish && t.regions[i] === t.regions[t.finish],
            )
            .sort(
              (a, b) =>
                distance(t.nodes[a], t.nodes[t.finish]) -
                  distance(t.nodes[b], t.nodes[t.finish]) || a - b,
            )[0]
        : start;
    if (finish === undefined) continue;
    const track = { ...t, start, finish };
    try {
      solve(track);
      return track;
    } catch {
      /* try another separate lane */
    }
  }
  throw Error("Brak przejezdnego miejsca dla przeciwnika");
}
export class Duel {
  player: Game;
  opponent: Game;
  turn: Side = "player";
  winner: Winner = null;
  reason = "";
  moves = 0;
  reverse: Record<Side, Reverse | null> = { player: null, opponent: null };
  private history: Snapshot[] = [];
  constructor(
    public track: Track,
    penaltyPoints = 0,
    redTrack = opponentTrack(track),
  ) {
    this.player = new Game(track, penaltyPoints);
    this.opponent = new Game(redTrack);
    this.opponent.started = true;
  }
  private snapshot(): Snapshot {
    return {
      player: this.player.fork(),
      opponent: this.opponent.fork(),
      turn: this.turn,
      winner: this.winner,
      reason: this.reason,
      moves: this.moves,
      reverse: { ...this.reverse },
    };
  }
  private restore(s: Snapshot) {
    this.player = s.player;
    this.opponent = s.opponent;
    this.turn = s.turn;
    this.winner = s.winner;
    this.reason = s.reason;
    this.moves = s.moves;
    this.reverse = { ...s.reverse };
  }
  private lineRule(
    side: Side,
    a: Point,
    b: Point,
    closing: boolean,
    reflection: Reverse | null = null,
  ): "ok" | "bounce" | "crossing" {
    const own = this[side],
      other = this[side === "player" ? "opponent" : "player"];
    let bounce = false;
    for (let i = 1; i < own.path.length; i++) {
      const p = own.track.nodes[own.path[i - 1]],
        q = own.track.nodes[own.path[i]],
        hit = segmentIntersection(a, b, p, q);
      if (!hit) continue;
      // One-cell retracing may cover old copies, but never cross a different
      // diagonal in the middle of a cell.
      if (
        reflection &&
        (hit.kind === "overlap" ||
          samePoint(hit.point, a) ||
          samePoint(hit.point, b))
      )
        continue;
      if (hit.kind === "overlap") return "crossing";
      if (samePoint(hit.point, a)) continue;
      if (
        closing &&
        samePoint(hit.point, b) &&
        samePoint(b, own.track.nodes[own.track.start])
      )
        continue;
      return "crossing";
    }
    const redSegments =
      other.path.length === 1
        ? [[other.path[0], other.path[0]]]
        : other.path.slice(1).map((id, i) => [other.path[i], id]);
    for (const [from, to] of redSegments) {
      const hit = segmentIntersection(
        a,
        b,
        other.track.nodes[from],
        other.track.nodes[to],
      );
      if (!hit) continue;
      if (hit.kind === "overlap") return "crossing";
      if (samePoint(hit.point, a)) continue;
      if (samePoint(hit.point, b)) {
        bounce = true;
        continue;
      }
      return "crossing";
    }
    return bounce ? "bounce" : "ok";
  }
  preview(
    side: Side,
    p: Point,
  ): { result: DuelResult; game: Game; bounce: Reverse | null } {
    const own = this[side],
      copy = own.fork(),
      a = own.track.nodes[own.last],
      forced = this.reverse[side];
    if (own.started && forced) {
      const dx = p.x - a.x,
        dy = p.y - a.y,
        len = Math.max(Math.abs(dx), Math.abs(dy));
      if (
        len > 0 &&
        (Math.sign(dx) !== forced.x ||
          Math.sign(dy) !== forced.y ||
          len > forced.limit)
      )
        return { result: "reverse", game: copy, bounce: forced };
    }
    // Retracing is legal only one cell at a time, on an existing own stroke.
    const len = Math.max(Math.abs(p.x - a.x), Math.abs(p.y - a.y));
    const retrace = own.path
      .slice(1)
      .some(
        (id, i) =>
          segmentIntersection(
            a,
            p,
            own.track.nodes[own.path[i]],
            own.track.nodes[id],
          )?.kind === "overlap",
      );
    if (retrace && len > 1)
      return { result: "reverse", game: copy, bounce: forced };
    const retreat = retrace && len === 1 ? { x: 0, y: 0, limit: 1 } : null;
    const result = copy.select(p);
    if (result !== "move" && result !== "crash")
      return { result, game: copy, bounce: forced };
    const target = result === "crash" ? copy.crashPoint! : p,
      rule = this.lineRule(side, a, target, copy.done, forced ?? retreat);
    if (rule === "crossing")
      return { result: "crossing", game: own.fork(), bounce: forced };
    const bounce =
      result === "move" && rule === "bounce" && !copy.done
        ? {
            x: Math.sign(a.x - p.x),
            y: Math.sign(a.y - p.y),
            limit: 1,
          }
        : null;
    return {
      result: result === "move" && bounce ? "bounce" : result,
      game: copy,
      bounce,
    };
  }
  select(p: Point): DuelResult {
    if (this.winner) return "finished";
    if (this.turn !== "player") return "turn";
    const candidate = this.preview("player", p);
    if (candidate.result === "start") {
      this.player = candidate.game;
      if (!this.unitMoves("player").length) {
        this.winner = "opponent";
        this.reason = "Brak legalnego ruchu gracza";
      }
      return "start";
    }
    if (
      candidate.result === "move" ||
      candidate.result === "bounce" ||
      candidate.result === "crash"
    ) {
      this.history.push(this.snapshot());
      this.player = candidate.game;
      this.reverse.player = candidate.bounce;
      this.moves++;
      if (this.player.crashed) {
        this.winner = "opponent";
        this.reason = "Wypadek gracza";
      } else this.next("player");
    }
    if (
      ["direction", "illegal", "crossing", "reverse"].includes(candidate.result)
    ) {
      this.history.push(this.snapshot());
      this.player.penaltyPoints -= ILLEGAL_PENALTY;
      this.moves++;
      this.next("player");
    }
    return candidate.result;
  }
  private next(side: Side) {
    if (this.moves > this.track.nodes.length * 6) {
      this.winner = "draw";
      this.reason = "Limit tur — remis";
      return;
    }
    if (this.player.done && this.opponent.done) {
      this.winner =
        Math.abs(this.player.score - this.opponent.score) < 1e-9
          ? this.player.penaltyPoints === this.opponent.penaltyPoints
            ? "draw"
            : this.player.penaltyPoints > this.opponent.penaltyPoints
              ? "player"
              : "opponent"
          : this.player.score > this.opponent.score
            ? "player"
            : "opponent";
      this.reason = "Porównanie ilorazów po ukończeniu obu przejazdów";
      return;
    }
    this.turn = this[side === "player" ? "opponent" : "player"].done
      ? side
      : side === "player"
        ? "opponent"
        : "player";
    if (this[this.turn].done)
      this.turn = this.turn === "player" ? "opponent" : "player";
    if (!this.unitMoves(this.turn).length) {
      this.winner = this.turn === "player" ? "opponent" : "player";
      this.reason =
        this.turn === "player"
          ? "Brak legalnego ruchu gracza"
          : "Przeciwnik zablokowany";
    }
  }
  unitMoves(side: Side) {
    return this[side].track.edges[this[side].last].filter((id) => {
      const result = this.preview(side, this[side].track.nodes[id]).result;
      return result === "move" || result === "bounce";
    });
  }
  private planOpponent(): number[] {
    const g = this.opponent,
      t = g.track,
      n = t.nodes.length,
      initial = g.stages.at(-1)! * n + g.last,
      queue = [initial],
      prev = new Map<number, number>(),
      seen = new Set([initial]);
    for (let i = 0; i < queue.length; i++) {
      const key = queue[i],
        node = key % n,
        stage = Math.floor(key / n);
      if (complete(t, node, stage)) {
        const path: number[] = [];
        let k: number | undefined = key;
        while (k !== undefined) {
          path.push(k % n);
          k = prev.get(k);
        }
        return path.reverse();
      }
      const neighbors: { next: number; stage: number }[] = [];
      for (const next of t.edges[node]) {
        const s = advance(t, node, next, stage);
        neighbors.push({ next, stage: s });
        if (t.difficulty < 6 || s < 0) continue;
        const a = t.nodes[node],
          b = t.nodes[next],
          dx = b.x - a.x,
          dy = b.y - a.y;
        if (dx && dy) continue;
        let current = next,
          currentStage = s;
        for (let step = 2; step <= t.size; step++) {
          const j = t.edges[current].find(
            (id) =>
              t.nodes[id].x === a.x + dx * step &&
              t.nodes[id].y === a.y + dy * step,
          );
          if (j === undefined) break;
          currentStage = advance(t, current, j, currentStage);
          if (currentStage < 0) break;
          neighbors.push({ next: j, stage: currentStage });
          current = j;
        }
      }
      // BFS costs one drawing click, so advanced AI plans whole straight strokes.
      if (t.difficulty >= 6) neighbors.reverse();
      for (const { next, stage: s } of neighbors) {
        if (s < 0) continue;
        const k = s * n + next;
        if (seen.has(k)) continue;
        const rule = this.lineRule(
          "opponent",
          t.nodes[node],
          t.nodes[next],
          complete(t, next, s),
        );
        if (rule === "crossing" || (rule === "bounce" && !complete(t, next, s)))
          continue;
        seen.add(k);
        prev.set(k, key);
        queue.push(k);
      }
    }
    return [];
  }
  playOpponent(): DuelResult {
    if (this.winner) return "finished";
    if (this.turn !== "opponent") return "turn";
    const options = this.unitMoves("opponent");
    if (!options.length) {
      this.winner = "player";
      this.reason = "Przeciwnik zablokowany";
      return "finished";
    }
    const plan = this.reverse.opponent ? [] : this.planOpponent();
    // Beginners occasionally choose a local alternative; advanced AI follows a
    // complete checkpoint-aware route and tests longer scoring strokes.
    const noise = random(`${this.track.seed}:choice:${this.moves}`)();
    if (
      !this.reverse.opponent &&
      noise < (10 - this.track.difficulty) * 0.025 &&
      options.length > 1
    )
      plan.splice(
        1,
        plan.length,
        options[Math.floor(noise * 1000) % options.length],
      );
    let target = plan[1] ?? options[0];
    const rng = random(`${this.track.seed}:red:${this.moves}`),
      span = 1 + Math.floor(rng() * (1 + this.track.difficulty * 2));
    if (plan.length > 2 && span > 1) {
      const a = this.opponent.track.nodes[plan[0]],
        b = this.opponent.track.nodes[plan[1]],
        dx = Math.sign(b.x - a.x),
        dy = Math.sign(b.y - a.y);
      if (!dx || !dy)
        for (let j = 2; j < Math.min(plan.length, span + 1); j++) {
          const p = this.opponent.track.nodes[plan[j]];
          if (
            (dx && p.y !== a.y) ||
            (dy && p.x !== a.x) ||
            Math.sign(p.x - a.x) !== dx ||
            Math.sign(p.y - a.y) !== dy
          )
            break;
          const result = this.preview("opponent", p).result;
          if (result !== "move" && result !== "bounce") break;
          target = plan[j];
        }
    }
    let candidate = this.preview("opponent", this.opponent.track.nodes[target]);
    if (candidate.result !== "move" && candidate.result !== "bounce") {
      target = options[0];
      candidate = this.preview("opponent", this.opponent.track.nodes[target]);
    }
    if (candidate.result !== "move" && candidate.result !== "bounce") {
      this.winner = "player";
      this.reason = "Przeciwnik zablokowany";
      return "finished";
    }
    this.opponent = candidate.game;
    this.reverse.opponent = candidate.bounce;
    this.moves++;
    this.next("opponent");
    return candidate.result;
  }
  undo() {
    if (this.player.crashed) return false;
    const snapshot = this.history.pop();
    if (!snapshot) return false;
    const penalty = this.player.penaltyPoints;
    this.restore(snapshot);
    this.player.penaltyPoints = penalty;
    return true;
  }
  clear() {
    const penalty = this.player.penaltyPoints;
    this.player = new Game(this.track, penalty);
    this.opponent = new Game(this.opponent.track);
    this.opponent.started = true;
    this.reverse = { player: null, opponent: null };
    this.turn = "player";
    this.winner = null;
    this.reason = "";
    this.moves = 0;
    this.history = [];
  }
}
