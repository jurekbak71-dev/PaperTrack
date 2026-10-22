import { segmentLength, scoreOf } from "../game/scoring";
import type { Track } from "../generator";
import { distance } from "../geometry";
export function advance(
  t: Track,
  node: number,
  next: number,
  stage: number,
): number {
  const a = t.regions[node],
    b = t.regions[next];
  if (a === b) return stage;
  if (b === a + 1 && b === stage + 1) return b;
  if (
    t.kind !== "rally" &&
    a === t.stages - 1 &&
    b === 0 &&
    stage === t.stages - 1
  )
    return t.stages;
  if (b > a + 1 || a > b + 1) return -1;
  return stage;
}
export const complete = (t: Track, node: number, stage: number) =>
  node === t.finish && stage === (t.kind === "rally" ? t.stages - 1 : t.stages);
export function solve(t: Track) {
  const n = t.nodes.length,
    initial = t.start,
    dist = new Map<number, number>([[initial, 0]]),
    prev = new Map<number, number>();
  const heap: [number, number][] = [];
  const push = (v: [number, number]) => {
    heap.push(v);
    let i = heap.length - 1;
    while (i) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= v[0]) break;
      heap[i] = heap[p];
      i = p;
    }
    heap[i] = v;
  };
  const pop = () => {
    const out = heap[0],
      v = heap.pop()!;
    if (heap.length) {
      let i = 0;
      while (i * 2 + 1 < heap.length) {
        let j = i * 2 + 1;
        if (j + 1 < heap.length && heap[j + 1][0] < heap[j][0]) j++;
        if (heap[j][0] >= v[0]) break;
        heap[i] = heap[j];
        i = j;
      }
      heap[i] = v;
    }
    return out;
  };
  push([0, initial]);
  while (heap.length) {
    const [cost, key] = pop();
    if (cost !== dist.get(key)) continue;
    const node = key % n,
      stage = Math.floor(key / n);
    if (complete(t, node, stage)) {
      const path: number[] = [];
      let k: number | undefined = key;
      while (k !== undefined) {
        path.push(k % n);
        k = prev.get(k);
      }
      return { length: cost, path: path.reverse() };
    }
    for (const next of t.edges[node]) {
      const s = advance(t, node, next, stage);
      if (s < 0) continue;
      const k = s * n + next,
        c = cost + distance(t.nodes[node], t.nodes[next]);
      if (c < (dist.get(k) ?? Infinity) - 1e-10) {
        dist.set(k, c);
        prev.set(k, key);
        push([c, k]);
      }
    }
  }
  throw Error("Tor nieprzejezdny");
}

/** Exact Pareto-label search for length × clicks, including checkpoint progress.
 * Labels trade distance against clicks; retaining only one per node is incorrect. */
export function solveScore(t: Track) {
  type Label = {
    key: number;
    length: number;
    clicks: number;
    prev: Label | null;
    alive: boolean;
  };
  const n = t.nodes.length,
    initial: Label = {
      key: t.start * 9,
      length: 0,
      clicks: 0,
      prev: null,
      alive: true,
    };
  const fronts = new Map<number, Label[]>([[initial.key, [initial]]]),
    heap: Label[] = [];
  const value = (l: Label) => scoreOf(l.length, l.clicks);
  const push = (l: Label) => {
    let i = heap.length;
    heap.push(l);
    while (i) {
      const p = (i - 1) >> 1;
      if (value(heap[p]) <= value(l)) break;
      heap[i] = heap[p];
      i = p;
    }
    heap[i] = l;
  };
  const pop = () => {
    const out = heap[0],
      tail = heap.pop()!;
    if (heap.length) {
      let i = 0;
      while (i * 2 + 1 < heap.length) {
        let j = i * 2 + 1;
        if (j + 1 < heap.length && value(heap[j + 1]) < value(heap[j])) j++;
        if (value(heap[j]) >= value(tail)) break;
        heap[i] = heap[j];
        i = j;
      }
      heap[i] = tail;
    }
    return out;
  };
  const direction = (a: number, b: number) => {
    const dx = t.nodes[b].x - t.nodes[a].x,
      dy = t.nodes[b].y - t.nodes[a].y;
    return dy === 0
      ? dx > 0
        ? 1
        : 2
      : dx === 0
        ? dy > 0
          ? 3
          : 4
        : 5 + (dy > 0 ? 2 : 0) + (dx > 0 ? 1 : 0);
  };
  push(initial);
  while (heap.length) {
    const current = pop();
    if (!current.alive) continue;
    const dir = current.key % 9,
      state = Math.floor(current.key / 9),
      node = state % n,
      stage = Math.floor(state / n);
    if (complete(t, node, stage)) {
      const units: number[] = [];
      let l: Label | null = current;
      while (l) {
        units.push(Math.floor(l.key / 9) % n);
        l = l.prev;
      }
      units.reverse();
      const path = [units[0]];
      let lastDir = 0;
      for (let i = 1; i < units.length; i++) {
        const d = direction(units[i - 1], units[i]);
        if (d <= 4 && d === lastDir) path[path.length - 1] = units[i];
        else path.push(units[i]);
        lastDir = d;
      }
      return {
        score: value(current),
        lengthSegments: current.length,
        clicks: current.clicks,
        path,
      };
    }
    for (const next of t.edges[node]) {
      const s = advance(t, node, next, stage);
      if (s < 0) continue;
      const d = direction(node, next),
        key = (s * n + next) * 9 + d,
        length = current.length + segmentLength(t.nodes[node], t.nodes[next]),
        clicks = current.clicks + (d <= 4 && dir === d ? 0 : 1),
        front = fronts.get(key) ?? [];
      if (front.some((l) => l.length <= length + 1e-9 && l.clicks <= clicks))
        continue;
      const retained = front.filter((l) => {
        if (l.length >= length - 1e-9 && l.clicks >= clicks) {
          l.alive = false;
          return false;
        }
        return true;
      });
      const label: Label = { key, length, clicks, prev: current, alive: true };
      retained.push(label);
      fronts.set(key, retained);
      push(label);
    }
  }
  throw Error("Tor nieprzejezdny");
}
