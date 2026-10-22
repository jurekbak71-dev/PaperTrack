import { it, expect } from "vitest";
import { Duel, opponentTrack, ILLEGAL_PENALTY } from "../src/game/duel";
import { Game } from "../src/game";
import {
  campaign,
  generate,
  defaultWidth,
  TRACK_WIDTH_SCALE,
  type Track,
} from "../src/generator";
import { segmentClear, segmentIntersection, type Point } from "../src/geometry";
import { solve } from "../src/solver";
function arena(): Track {
  const nodes: Point[] = [],
    outer = [
      { x: 0, y: 0 },
      { x: 12, y: 0 },
      { x: 12, y: 8 },
      { x: 0, y: 8 },
    ];
  for (let y = 1; y < 8; y++) for (let x = 1; x < 12; x++) nodes.push({ x, y });
  const edges = nodes.map((a) =>
    nodes.flatMap((b, i) =>
      Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) === 1 &&
      segmentClear(a, b, outer, [])
        ? [i]
        : [],
    ),
  );
  const node = (x: number, y: number) =>
    nodes.findIndex((p) => p.x === x && p.y === y);
  return {
    seed: "arena",
    kind: "rally",
    difficulty: 1,
    width: 4,
    outer,
    hole: [],
    nodes,
    edges,
    regions: nodes.map((p) => (p.x >= 10 ? 1 : 0)),
    start: node(2, 2),
    finish: node(10, 2),
    stages: 2,
    center: [],
    size: 12,
    fallback: false,
  };
}
const id = (t: Track, x: number, y: number) =>
  t.nodes.findIndex((p) => p.x === x && p.y === y);
function match() {
  const t = arena();
  return new Duel(t, 0, { ...t, start: id(t, 2, 4), finish: id(t, 10, 4) });
}
function setPath(g: Game, points: Point[]) {
  g.path = points.map((p) => id(g.track, p.x, p.y));
  g.stages = g.path.map(() => 0);
  g.started = true;
}
it("odróżnia przecięcie, styczność i pokrywanie odcinków", () => {
  expect(
    segmentIntersection(
      { x: 2, y: 2 },
      { x: 3, y: 3 },
      { x: 2, y: 3 },
      { x: 3, y: 2 },
    ),
  ).toEqual({ kind: "point", point: { x: 2.5, y: 2.5 } });
  expect(
    segmentIntersection(
      { x: 1, y: 2 },
      { x: 5, y: 2 },
      { x: 3, y: 2 },
      { x: 6, y: 2 },
    )?.kind,
  ).toBe("overlap");
  expect(
    segmentIntersection(
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
    ),
  ).toBeNull();
});
it("oddzielne starty i naprzemienne tury; brak ruchu gracza w turze AI", () => {
  const m = match();
  expect(m.player.last).not.toBe(m.opponent.last);
  expect(m.select({ x: 2, y: 2 })).toBe("start");
  expect(m.turn).toBe("player");
  expect(m.select({ x: 3, y: 2 })).toBe("move");
  expect(m.turn).toBe("opponent");
  expect(m.select({ x: 4, y: 2 })).toBe("turn");
  expect(m.player.clicks).toBe(1);
  expect(m.playOpponent()).toMatch(/move|bounce/);
  expect(m.opponent.clicks).toBe(1);
  expect(m.turn).toBe("player");
});
it("przecięcie czerwonej linii odrzuca ruch i kosztuje punkt oraz turę", () => {
  const m = match();
  setPath(m.player, [{ x: 2, y: 3 }]);
  setPath(m.opponent, [
    { x: 6, y: 1 },
    { x: 6, y: 5 },
  ]);
  expect(m.select({ x: 10, y: 3 })).toBe("crossing");
  expect(m.player.clicks).toBe(0);
  expect(m.player.penaltyPoints).toBe(-ILLEGAL_PENALTY);
  expect(m.turn).toBe("opponent");
});
it("wejście na punkt czerwonej linii wymusza dokładny powrót; wyjątek cofnięcia nie pozwala nakładać dalszych linii", () => {
  const m = match();
  setPath(m.player, [{ x: 2, y: 3 }]);
  setPath(m.opponent, [
    { x: 6, y: 1 },
    { x: 6, y: 5 },
  ]);
  expect(m.select({ x: 6, y: 3 })).toBe("bounce");
  expect(m.reverse.player).toEqual({ x: -1, y: 0, limit: 1 });
  m.playOpponent();
  expect(m.select({ x: 6, y: 4 })).toBe("reverse");
  expect(m.player.penaltyPoints).toBe(-1);
  m.playOpponent();
  expect(m.select({ x: 5, y: 3 })).toBe("move");
  expect(m.reverse.player).toBeNull();
  m.playOpponent();
  expect(m.preview("player", { x: 4, y: 3 }).result).toBe("loop");
  expect(m.preview("player", { x: 5, y: 4 }).result).toBe("move");
});
it("nie wolno przeciąć przekątnych ani własnej wcześniejszej linii", () => {
  const m = match();
  setPath(m.player, [{ x: 2, y: 2 }]);
  setPath(m.opponent, [
    { x: 2, y: 3 },
    { x: 3, y: 2 },
  ]);
  expect(m.preview("player", { x: 3, y: 3 }).result).toBe("crossing");
  setPath(m.player, [
    { x: 2, y: 2 },
    { x: 6, y: 2 },
    { x: 6, y: 5 },
    { x: 4, y: 5 },
  ]);
  setPath(m.opponent, [{ x: 10, y: 6 }]);
  expect(m.preview("player", { x: 4, y: 1 }).result).toBe("crossing");
});
it("zamknięcie pełnego okrążenia może dotknąć własnego startu", () => {
  const t = arena(),
    m = new Duel(
      {
        ...t,
        kind: "oval",
        stages: 1,
        regions: t.nodes.map(() => 0),
        finish: t.start,
      },
      0,
      { ...t, start: id(t, 10, 4), finish: id(t, 10, 4) },
    );
  setPath(m.player, [
    { x: 2, y: 2 },
    { x: 6, y: 2 },
    { x: 6, y: 5 },
    { x: 2, y: 5 },
  ]);
  m.player.stages = [0, 0, 1, 1];
  expect(m.preview("player", { x: 2, y: 2 }).result).toBe("move");
});
it("nielegalny kierunek traci turę; cofanie pary tur zachowuje naliczoną karę", () => {
  const m = match();
  m.select({ x: 2, y: 2 });
  expect(m.select({ x: 4, y: 4 })).toBe("direction");
  expect(m.player.penaltyPoints).toBe(-1);
  m.playOpponent();
  expect(m.undo()).toBe(true);
  expect(m.opponent.clicks).toBe(0);
  expect(m.player.penaltyPoints).toBe(-1);
  expect(m.turn).toBe("player");
  m.clear();
  expect(m.player.penaltyPoints).toBe(-1);
});
it("wypadek daje przeciwnikowi zwycięstwo; AI nie wykonuje ruchów po końcu meczu", () => {
  const m = match();
  m.select({ x: 2, y: 2 });
  expect(m.select({ x: 0, y: 2 })).toBe("crash");
  expect(m.winner).toBe("opponent");
  expect(m.player.penaltyPoints).toBe(-5);
  expect(m.playOpponent()).toBe("finished");
  expect(m.undo()).toBe(false);
});
it("po ukończeniu obu przejazdów wygrywa wyższy iloraz", () => {
  const m = match();
  m.select({ x: 2, y: 2 });
  let safety = 0;
  for (let x = 3; x <= 10; x++) {
    expect(m.select({ x, y: 2 })).toBe("move");
    while (m.turn === "opponent" && !m.winner) {
      m.playOpponent();
      expect(++safety).toBeLessThan(50);
    }
  }
  expect(m.player.done).toBe(true);
  expect(m.opponent.done).toBe(true);
  expect(m.player.score).toBe(1);
  expect(m.winner).toBe(m.opponent.score === 1 ? "draw" : "opponent");
});
it("blokada przeciwnika kończy mecz", () => {
  const m = match();
  m.turn = "opponent";
  m.opponent.track = {
    ...m.opponent.track,
    edges: m.opponent.track.edges.map(() => []),
  };
  expect(m.playOpponent()).toBe("finished");
  expect(m.winner).toBe("player");
});
it("100 poziomów: oba starty przejezdne, malejąca szerokość, więcej zakrętów i bramek", () => {
  let previous = Infinity;
  for (let l = 1; l <= 100; l++) {
    const t = campaign(l),
      red = opponentTrack(t);
    expect(t.width).toBeLessThanOrEqual(previous + 1e-8);
    previous = t.width;
    expect(t.width).toBeLessThanOrEqual(defaultWidth(t.difficulty) + 1e-8);
    expect(red.start).toBe(t.start);
    expect(red.finish).toBe(t.finish);
    expect(solve(red).path.length).toBeGreaterThan(1);
  }
  expect(campaign(80).center.length).toBeGreaterThan(
    campaign(40).center.length,
  );
  expect(campaign(80).stages).toBeGreaterThan(campaign(10).stages);
  expect(TRACK_WIDTH_SCALE).toBe(0.9);
  expect(defaultWidth(1)).toBe(6.3);
  expect(generate("w", "oval", 10).width).toBeLessThanOrEqual(2);
}, 120000);

it("dobrowolny powrót i odbicie są ograniczone do jednej kratki", () => {
  const m = match();
  setPath(m.player, [
    { x: 2, y: 3 },
    { x: 6, y: 3 },
  ]);
  setPath(m.opponent, [{ x: 10, y: 6 }]);
  expect(m.preview("player", { x: 4, y: 3 }).result).toBe("reverse");
  expect(m.preview("player", { x: 5, y: 3 }).result).toBe("move");
  m.select({ x: 5, y: 3 });
  m.turn = "player";
  expect(m.select({ x: 4, y: 3 })).toBe("loop");
  expect(m.mustBranch.player).toBe(true);
  m.turn = "player";
  expect(m.select({ x: 5, y: 4 })).toBe("move");
  expect(m.mustBranch.player).toBe(false);
});
it("brak ruchów przegrywa; cofnięcie bez nowego wyjścia jest zapętleniem", () => {
  const m = match();
  m.player.track = {
    ...m.player.track,
    edges: m.player.track.edges.map(() => []),
  };
  expect(m.select({ x: 2, y: 2 })).toBe("start");
  expect(m.winner).toBe("opponent");
  const n = match();
  setPath(n.player, [
    { x: 2, y: 2 },
    { x: 6, y: 2 },
  ]);
  n.player.track = {
    ...n.player.track,
    edges: n.player.track.edges.map((_, i) =>
      i === n.player.last ? [id(n.player.track, 5, 2)] : [],
    ),
  };
  expect(n.unitMoves("player")).toEqual([]);
  n.player.track.edges[id(n.player.track, 5, 2)] = [id(n.player.track, 5, 3)];
  expect(n.unitMoves("player")).toEqual([id(n.player.track, 5, 2)]);
});
it("silniejsze AI planuje całe proste i osiąga wyższy iloraz na tej samej planszy", () => {
  const results: number[] = [];
  for (const difficulty of [1, 9]) {
    const t = { ...arena(), difficulty },
      m = new Duel(t, 0, { ...t, start: id(t, 2, 4), finish: id(t, 10, 4) });
    m.select({ x: 2, y: 2 });
    m.select({ x: 10, y: 2 });
    for (let i = 0; i < 100 && !m.winner; i++) m.playOpponent();
    expect(m.opponent.done).toBe(true);
    results.push(m.opponent.score);
  }
  expect(results[1]).toBeGreaterThan(results[0]);
  expect(results[1]).toBe(8);
});

it("wspólny start nie jest odbiciem i oba kolory mogą wyjechać różnymi liniami", () => {
  const t = arena(),
    m = new Duel(t);
  expect(m.player.last).toBe(m.opponent.last);
  m.select(t.nodes[t.start]);
  expect(m.reverse.player).toBeNull();
  expect(m.select({ x: 5, y: 2 })).toBe("move");
  expect(m.reverse.player).toBeNull();
  expect(m.playOpponent()).toMatch(/move|bounce/);
  expect(m.opponent.clicks).toBe(1);
  expect(m.opponent.path[0]).toBe(t.start);
  expect(m.player.path[0]).toBe(t.start);
  expect(m.preview("player", t.nodes[t.start]).result).not.toBe("move");
});
it("cofanie nie może tworzyć oscylacji, stan jest przywracany przy undo i resecie", () => {
  const m = match();
  m.select({ x: 2, y: 2 });
  m.select({ x: 6, y: 2 });
  m.playOpponent();
  expect(m.select({ x: 5, y: 2 })).toBe("move");
  expect(m.mustBranch.player).toBe(true);
  expect(m.preview("player", { x: 6, y: 2 }).result).toBe("loop");
  expect(m.preview("player", { x: 4, y: 2 }).result).toBe("loop");
  expect(m.undo()).toBe(true);
  expect(m.mustBranch.player).toBe(false);
  m.clear();
  expect(m.mustBranch).toEqual({ player: false, opponent: false });
});
it("strona z samymi ruchami prowadzącymi do pętli przegrywa, także AI", () => {
  for (const side of ["player", "opponent"] as const) {
    const m = match(),
      g = m[side],
      other = side === "player" ? "opponent" : "player";
    setPath(g, [
      { x: 2, y: 2 },
      { x: 6, y: 2 },
    ]);
    g.track = {
      ...g.track,
      edges: g.track.edges.map((_, i) =>
        i === g.last ? [id(g.track, 5, 2)] : [],
      ),
    };
    if (side === "opponent") {
      m.turn = side;
      m.playOpponent();
    } else {
      m.turn = "opponent";
      m.playOpponent();
    }
    expect(m.winner).toBe(other);
    expect(m.reason).toContain("zapętlenia");
  }
});
