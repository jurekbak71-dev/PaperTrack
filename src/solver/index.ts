import { scoreOf } from "../game/scoring";
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
  if (t.kind !== "rally" && a === 0 && b === t.stages - 1) return stage;
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

/** Each unit segment has length one and needs one click. The quotient is
 * bounded below by one and a legal unit-step route attains that bound.
 * This is a free-track witness, not a prediction against a moving opponent. */
export function solveScore(t: Track) {
  const route = solve(t),
    lengthSegments = route.path.length - 1,
    clicks = lengthSegments;
  return {
    score: scoreOf(lengthSegments, clicks),
    lengthSegments,
    clicks,
    path: route.path,
  };
}
