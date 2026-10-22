import { Game } from "./index";
import { advance, complete } from "../solver";
import { samePoint, segmentIntersection, type Point } from "../geometry";
import { random, type Track } from "../generator";
export const ILLEGAL_PENALTY = 1;
export type Side = "player" | "opponent";
export type Winner = Side | "draw" | null;
type Reverse = { x: number; y: number; limit: number };
type Snapshot = {
  player: Game;
  opponent: Game;
  reverse: Record<Side, Reverse | null>;
  mustBranch: Record<Side, boolean>;
  turn: Side;
  winner: Winner;
  pat: boolean;
  reason: string;
  moves: number;
};
export type DuelResult =
  | ReturnType<Game["select"]>
  | "turn"
  | "crossing"
  | "reverse"
  | "bounce"
  | "finished"
  | "loop";
export function opponentTrack(t: Track): Track {
  // Both racers use the same start, finish and checkpoint graph.
  return { ...t };
}
export class Duel {
  player: Game;
  opponent: Game;
  turn: Side = "player";
  winner: Winner = null;
  pat = false;
  reason = "";
  moves = 0;
  reverse: Record<Side, Reverse | null> = { player: null, opponent: null };
  mustBranch: Record<Side, boolean> = { player: false, opponent: false };
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
      pat: this.pat,
      reason: this.reason,
      moves: this.moves,
      reverse: { ...this.reverse },
      mustBranch: { ...this.mustBranch },
    };
  }
  private restore(s: Snapshot) {
    this.player = s.player;
    this.opponent = s.opponent;
    this.turn = s.turn;
    this.winner = s.winner;
    this.pat = s.pat;
    this.reason = s.reason;
    this.moves = s.moves;
    this.reverse = { ...s.reverse };
    this.mustBranch = { ...s.mustBranch };
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
  ): {
    result: DuelResult;
    game: Game;
    bounce: Reverse | null;
    retreat?: boolean;
  } {
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
    if (retrace && this.mustBranch[side])
      return { result: "loop", game: copy, bounce: forced };
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
      retreat: !!retreat,
    };
  }
  select(p: Point): DuelResult {
    if (this.winner) return "finished";
    if (this.turn !== "player") return "turn";
    const candidate = this.preview("player", p);
    if (candidate.result === "start") {
      this.player = candidate.game;
      this.resolveBlockage("player");
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
      this.mustBranch.player = !!candidate.retreat;
      this.moves++;
      if (this.player.crashed) {
        this.winner = "opponent";
        this.reason = "Wypadek gracza";
      } else this.next("player");
    }
    if (
      ["direction", "illegal", "crossing", "reverse", "loop"].includes(
        candidate.result,
      )
    ) {
      this.history.push(this.snapshot());
      this.player.penaltyPoints -= ILLEGAL_PENALTY;
      this.moves++;
      this.next("player");
    }
    return candidate.result;
  }
  private next(side: Side) {
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
    if (this.resolveBlockage(this.turn)) return;
    if (this.moves > this.track.nodes.length * 6) {
      this.winner = "draw";
      this.reason = "Limit tur — remis";
    }
  }
  /** Resolve simultaneous immobility before assigning a loss by turn order.
   * A finisher is not a blocked racer and cannot cause a false PAT. */
  private resolveBlockage(side: Side) {
    const blocked = {
      player: !this.player.done && !this.unitMoves("player").length,
      opponent: !this.opponent.done && !this.unitMoves("opponent").length,
    };
    if (blocked.player && blocked.opponent) {
      this.winner = "draw";
      this.pat = true;
      this.reason = "Obie strony bez ruchu niewymagającego zapętlenia";
      return true;
    }
    if (!blocked[side]) return false;
    this.winner = side === "player" ? "opponent" : "player";
    this.reason =
      side === "player"
        ? "Gracz zablokowany — brak ruchu bez zapętlenia"
        : "Przeciwnik zablokowany — brak ruchu bez zapętlenia";
    return true;
  }
  private playable(side: Side, candidate: ReturnType<Duel["preview"]>) {
    return (
      (candidate.result === "move" || candidate.result === "bounce") &&
      ((!candidate.retreat && !candidate.bounce) ||
        this.hasExit(side, candidate, 2))
    );
  }
  unitMoves(side: Side): number[] {
    // Availability concerns drawing, even before the human selects START.
    if (!this[side].started) {
      const copy = Object.assign(Object.create(Duel.prototype) as Duel, this);
      copy[side] = this[side].fork();
      copy[side].started = true;
      return copy.unitMoves(side);
    }
    return this[side].track.edges[this[side].last].filter((id) =>
      this.playable(side, this.preview(side, this[side].track.nodes[id])),
    );
  }
  /** A bounce/retreat is not an escape if it can only repeat an old stroke.
   * Look through at most the forced retreat and the following fresh departure. */
  private hasExit(
    side: Side,
    candidate: ReturnType<Duel["preview"]>,
    depth: number,
  ): boolean {
    if (candidate.game.done) return true;
    if (!depth) return false;
    const copy = Object.assign(Object.create(Duel.prototype) as Duel, this);
    copy[side] = candidate.game;
    copy.reverse = { ...this.reverse, [side]: candidate.bounce };
    copy.mustBranch = { ...this.mustBranch, [side]: !!candidate.retreat };
    for (const id of copy[side].track.edges[copy[side].last]) {
      const next = copy.preview(side, copy[side].track.nodes[id]);
      if (next.result !== "move" && next.result !== "bounce") continue;
      if (
        (!next.retreat && !next.bounce) ||
        copy.hasExit(side, next, depth - 1)
      )
        return true;
    }
    return false;
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
  /** With no complete plan, prefer a new line with exits over pointless retreat.
   * Higher levels also consider their mobility and the human's remaining exits. */
  private fallbackOpponent(options: number[]) {
    let best = options[0],
      bestScore = -Infinity;
    for (const id of options) {
      const candidate = this.preview("opponent", this.opponent.track.nodes[id]);
      if (candidate.game.done) return id;
      let score = (candidate.retreat ? -100 : 0) + (candidate.bounce ? -20 : 0);
      if (this.track.difficulty >= 3) {
        const copy = Object.assign(Object.create(Duel.prototype) as Duel, this);
        copy.opponent = candidate.game;
        copy.reverse = { ...this.reverse, opponent: candidate.bounce };
        copy.mustBranch = { ...this.mustBranch, opponent: !!candidate.retreat };
        const exits = copy.unitMoves("opponent").length;
        score += exits ? exits * this.track.difficulty : -1000;
        score +=
          (candidate.game.stages.at(-1)! - this.opponent.stages.at(-1)!) * 20;
        if (this.track.difficulty >= 6)
          score -= copy.unitMoves("player").length;
      }
      if (score > bestScore) {
        bestScore = score;
        best = id;
      }
    }
    return best;
  }
  playOpponent(): DuelResult {
    if (this.winner) return "finished";
    if (this.turn !== "opponent") return "turn";
    const options = this.unitMoves("opponent");
    if (!options.length) {
      this.resolveBlockage("opponent");
      return "finished";
    }
    const plan = this.reverse.opponent ? [] : this.planOpponent();
    // The planner is optimistic about future branches; the immediate stroke
    // must obey the same anti-loop rule as the human player.
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
    const fallback = this.fallbackOpponent(options);
    let target = plan[1] ?? fallback;
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
          if (!this.playable("opponent", this.preview("opponent", p))) break;
          target = plan[j];
        }
    }
    let candidate = this.preview("opponent", this.opponent.track.nodes[target]);
    if (!this.playable("opponent", candidate)) {
      target = fallback;
      candidate = this.preview("opponent", this.opponent.track.nodes[target]);
    }
    if (candidate.result !== "move" && candidate.result !== "bounce") {
      this.resolveBlockage("opponent");
      return "finished";
    }
    this.opponent = candidate.game;
    this.reverse.opponent = candidate.bounce;
    this.mustBranch.opponent = !!candidate.retreat;
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
    this.mustBranch = { player: false, opponent: false };
    this.turn = "player";
    this.winner = null;
    this.pat = false;
    this.reason = "";
    this.moves = 0;
    this.history = [];
  }
}
