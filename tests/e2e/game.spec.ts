import { solve } from "../../src/solver";
import { Game } from "../../src/game";
import { test, expect, type Page } from "@playwright/test";
import { generate, type Track } from "../../src/generator";
import { Duel } from "../../src/game/duel";

async function nodeClick(
  page: Page,
  track: Track,
  id: number,
  zoom = 1,
  pan = { x: 0, y: 0 },
) {
  await pointClick(page, track.nodes[id], zoom, pan);
}
async function pointClick(
  page: Page,
  p: { x: number; y: number },
  zoom = 1,
  pan = { x: 0, y: 0 },
) {
  const canvas = page.locator("canvas");
  const read = () =>
    canvas.evaluate((el) => ({
      cell: Number(el.dataset.cell),
      x: Number(el.dataset.originX),
      y: Number(el.dataset.originY),
    }));
  let box = (await canvas.boundingBox())!,
    view = await read();
  let localX = view.x + p.x * view.cell,
    localY = view.y + p.y * view.cell;
  if (
    localX < 3 ||
    localX > box.width - 3 ||
    localY < 3 ||
    localY > box.height - 3
  ) {
    await page.locator("#fit").click();
    box = (await canvas.boundingBox())!;
    view = await read();
    localX = view.x + p.x * view.cell;
    localY = view.y + p.y * view.cell;
  }
  const height = page.viewportSize()!.height;
  if (box.y + localY < 20 || box.y + localY > height - 20) {
    await page.evaluate(
      (delta) => window.scrollBy(0, delta),
      box.y + localY - height / 2,
    );
    box = (await canvas.boundingBox())!;
  }
  const x = box.x + localX,
    y = box.y + localY;
  void zoom;
  void pan;
  if (test.info().project.name === "chromium") await page.mouse.click(x, y);
  else await page.touchscreen.tap(x, y);
}

test("pojedynek: oba przejazdy, iloraz, zwycięzca, rekord i offline", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const track = generate("duel-e2e", "rally", 1),
    witness = new Game(track);
  witness.select(track.nodes[track.start]);
  expect(witness.select(track.nodes[track.finish])).toBe("move");
  await page.goto("./#PT1-rally-1-duel-e2e");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator(".players")).toContainText("Ty — niebieski");
  await expect(page.locator(".players")).toContainText("AI — czerwony");
  await expect(page.getByText("Pokaż najlepszą trasę")).toHaveCount(0);
  await nodeClick(page, track, track.start);
  await expect(page.locator("#clicks")).toHaveText("0");
  await nodeClick(page, track, track.finish);
  await expect(page.locator("#result")).toContainText("Meta!");
  await expect(page.locator("#score")).toHaveText(String(witness.score));
  await expect(page.locator("#match-result")).toContainText("Wygrywasz!", {
    timeout: 15000,
  });
  const theirs = Number(
    (await page.locator("#opponent-score").innerText()).replace(",", "."),
  );
  expect(theirs).toBeGreaterThanOrEqual(1);
  expect(theirs).toBeLessThan(witness.score);
  await page.getByRole("button", { name: "← Menu" }).click();
  await page.getByRole("button", { name: "Moje rekordy" }).click();
  await expect(page.locator("#app")).toContainText("PT1-rally-1-duel-e2e");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    await new Promise<void>((resolve) => {
      if (navigator.serviceWorker.controller) resolve();
      else
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        );
    });
  });
  await page.context().setOffline(true);
  await page.reload();
  await expect(page.locator("canvas")).toBeVisible();
  await nodeClick(page, track, track.start);
  const p = track.nodes[track.start];
  await pointClick(page, { x: p.x + 2, y: p.y });
  await expect(page.locator("#score")).toHaveText("2");
  await expect(page.locator("#opponent-clicks")).not.toHaveText("0");
  expect(errors).toEqual([]);
});

test("kampania, kod i responsywny układ", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Kampania", exact: true }).click();
  await expect(page.locator("[data-level]")).toHaveCount(100);
  await page.locator('[data-level="100"]').click();
  await expect(page.locator(".eyebrow").last()).toContainText("Trudność 10/10");
  await expect(page.locator(".eyebrow").last()).toContainText("1.90 kr.");
  await expect(page.locator("canvas")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator("canvas")).toBeVisible();
});

test("nielegalny ruch kosztuje punkt i turę, cofanie zachowuje karę, wypadek przegrywa", async ({
  page,
}) => {
  const track = generate("duel-e2e", "rally", 1),
    start = track.nodes[track.start];
  await page.goto("./#PT1-rally-1-duel-e2e");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("#app")).not.toContainText("podświetl");
  await pointClick(page, start);
  await pointClick(page, { x: start.x + 2, y: start.y + 2 });
  await expect(page.locator("#penalties")).toContainText("-1 pkt");
  await expect(page.locator("#clicks")).toHaveText("0");
  await expect(page.locator("#opponent-clicks")).toHaveText("1");
  await expect(page.locator("#turn")).toContainText("Twoja tura");
  await page.getByRole("button", { name: "Cofnij", exact: true }).click();
  await expect(page.locator("#opponent-clicks")).toHaveText("0");
  await pointClick(page, { x: start.x + 3, y: start.y });
  await expect(page.locator("#score")).toHaveText("3");
  await expect(page.locator("#clicks")).toHaveText("1");
  await expect(page.locator("#opponent-clicks")).toHaveText("1");
  await page.getByRole("button", { name: "Cofnij", exact: true }).click();
  await expect(page.locator("#score")).toHaveText("0");
  await expect(page.locator("#opponent-clicks")).toHaveText("0");
  await expect(page.locator("#penalties")).toContainText("-1 pkt");
  await pointClick(page, { x: 0, y: start.y });
  await expect(page.locator("#result")).toContainText("Wypadek");
  await expect(page.locator("#match-result")).toContainText(
    "Wygrywa przeciwnik",
  );
  await expect(page.locator("#penalties")).toContainText("-6 pkt");
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await expect(page.locator("#penalties")).toContainText("-6 pkt");
  await expect(page.locator("#opponent-clicks")).toHaveText("0");
  await page.reload();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("#penalties")).toContainText("-6 pkt");
});

test("odbicie od punktu przeciwnika wymusza przeciwny kierunek", async ({
  page,
}) => {
  const track = generate("duel-e2e", "rally", 1),
    model = new Duel(track),
    start = track.nodes[track.start],
    first = { x: start.x + 1, y: start.y };
  model.select(start);
  model.select(first);
  model.playOpponent();
  const contact = track.nodes[model.opponent.last];
  expect(model.preview("player", contact).result).toBe("bounce");
  await page.goto("./#PT1-rally-1-duel-e2e");
  await expect(page.locator("canvas")).toBeVisible();
  await pointClick(page, start);
  await pointClick(page, first);
  await expect(page.locator("#opponent-clicks")).toHaveText("1");
  await pointClick(page, contact);
  await expect(page.locator("#status")).toContainText("Odbicie");
  await expect(page.locator("#opponent-clicks")).toHaveText("2");
  await expect(page.locator("#turn")).toContainText("Twoja tura");
  await pointClick(page, { x: contact.x + 1, y: contact.y });
  await expect(page.locator("#status")).toContainText("przeciwny");
  await expect(page.locator("#penalties")).toContainText("-1 pkt");
  await expect(page.locator("#opponent-clicks")).toHaveText("3");
  await pointClick(page, first);
  await expect(page.locator("#clicks")).toHaveText("3");
  await expect(page.locator("#score")).toHaveText("1");
  await expect(page.locator("#status")).toContainText("nową ścieżkę");
});

test("przeciąganie i anulowanie gestu nie dodają odcinków", async ({
  page,
}) => {
  const track = generate("gest", "rally", 3),
    start = track.nodes[track.start],
    next = track.nodes[track.edges[track.start][0]];
  await page.goto("./#PT1-rally-3-gest");
  await expect(page.locator("canvas")).toBeVisible();
  await pointClick(page, start);
  const box = (await page.locator("canvas").boundingBox())!;
  const view = await page
    .locator("canvas")
    .evaluate((el) => ({
      cell: Number(el.dataset.cell),
      x: Number(el.dataset.originX),
      y: Number(el.dataset.originY),
    }));
  await page.mouse.move(
    box.x + view.x + start.x * view.cell,
    box.y + view.y + start.y * view.cell,
  );
  await page.mouse.down();
  await page.mouse.move(
    box.x + view.x + next.x * view.cell,
    box.y + view.y + next.y * view.cell,
  );
  await page.mouse.up();
  await expect(page.locator("#clicks")).toHaveText("0");
  await expect(page.locator("#status")).toContainText(
    "Przeciąganie nie dodaje",
  );
  await page.mouse.move(
    box.x + view.x + next.x * view.cell,
    box.y + view.y + next.y * view.cell,
  );
  await page.mouse.down();
  await page
    .locator("canvas")
    .dispatchEvent("pointercancel", { pointerId: 1, isPrimary: true });
  await page.mouse.up();
  await expect(page.locator("#clicks")).toHaveText("0");
});

test("kliknięcia uwzględniają powiększenie i przesunięcie", async ({
  page,
}) => {
  const track = generate("zoom", "oval", 1),
    solution = solve(track);
  await page.goto("./#PT1-oval-1-zoom");
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Przybliż", exact: true }).click();
  if (test.info().project.name === "chromium")
    await page
      .getByRole("button", { name: "Przesuń w prawo", exact: true })
      .click();
  else {
    const box = (await page.locator("canvas").boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 60, box.y + box.height / 2);
    await page.mouse.up();
  }
  await nodeClick(page, track, track.start, 1.25, { x: -3, y: 0 });
  await nodeClick(page, track, solution.path[1], 1.25, { x: -3, y: 0 });
  await expect(page.locator("#score")).not.toHaveText("0");
});

test("generator nie blokuje kolejki zdarzeń interfejsu", async ({ page }) => {
  await page.goto("./");
  await page.evaluate(() => {
    (window as Window & { ticks?: number }).ticks = 0;
    setInterval(() => {
      const w = window as Window & { ticks?: number };
      w.ticks = (w.ticks ?? 0) + 1;
    }, 5);
  });
  await page.getByRole("button", { name: "Nowa gra" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  expect(
    await page.evaluate(() => (window as Window & { ticks?: number }).ticks),
  ).toBeGreaterThan(0);
});

test("trudność 10: kod, przekątna i kara za prostą", async ({ page }) => {
  const t = generate("diagonal-browser", "rally", 10),
    start = t.nodes[t.start];
  await page.goto("./#PT1-rally-10-diagonal-browser");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator(".click-help")).toContainText(
    "wyłącznie przekątne",
  );
  await pointClick(page, start);
  await pointClick(page, { x: start.x + 1, y: start.y });
  await expect(page.locator("#penalties")).toContainText("-1 pkt");
  await expect(page.locator("#turn")).toContainText("Twoja tura");
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await pointClick(page, start);
  const next = solve(t).path[1];
  await nodeClick(page, t, next);
  await expect(page.locator("#clicks")).toHaveText("1");
  await expect(page.locator("#score")).toHaveText("1");
});

test("dobrowolne cofnięcie tylko o jedną kratkę", async ({ page }) => {
  const t = generate("duel-e2e", "rally", 1),
    p = t.nodes[t.start];
  await page.goto("./#PT1-rally-1-duel-e2e");
  await expect(page.locator("canvas")).toBeVisible();
  await pointClick(page, p);
  await pointClick(page, { x: p.x + 4, y: p.y });
  await expect(page.locator("#turn")).toContainText("Twoja tura");
  await pointClick(page, { x: p.x + 2, y: p.y });
  await expect(page.locator("#penalties")).toContainText("-1 pkt");
  await expect(page.locator("#turn")).toContainText("Twoja tura");
  await pointClick(page, { x: p.x + 3, y: p.y });
  await expect(page.locator("#clicks")).toHaveText("2");
  await expect(page.locator("#score")).toHaveText("2,5");
  await expect(page.locator("#turn")).toContainText("Twoja tura");
  await pointClick(page, { x: p.x + 2, y: p.y });
  await expect(page.locator("#penalties")).toContainText("-2 pkt");
  await expect(page.locator("#clicks")).toHaveText("2");
  await expect(page.locator("#status")).toContainText("nową ścieżkę");
});

test("plansza ma wspólną kropkę START i brak numerowanych strzałek", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const labels: string[] = [];
    (window as Window & { paintedLabels?: string[] }).paintedLabels = labels;
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (
      ...args: Parameters<typeof original>
    ) {
      labels.push(args[0]);
      return original.apply(this, args);
    };
  });
  await page.goto("./#PT1-oval-3-shared-start");
  await expect(page.locator("canvas")).toBeVisible();
  const labels = await page.evaluate(
    () => (window as Window & { paintedLabels?: string[] }).paintedLabels!,
  );
  expect(labels.some((label) => /→|\d/.test(label))).toBe(false);
  expect(labels).toContain("START / META");
  expect(labels).not.toContain("START AI");
  await expect(page.locator("#app")).toContainText("tej samej kropki");
});

test("obustronna blokada pokazuje PAT i zatrzymuje ruchy AI", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(...args: ConstructorParameters<typeof Worker>) {
        super(...args);
        this.addEventListener("message", (e) => {
          if (!e.data.track) return;
          e.data.track.edges = e.data.track.edges.map(() => []);
          e.data.redTrack.edges = e.data.redTrack.edges.map(() => []);
        });
      }
    };
  });
  const t = generate("pat-browser", "rally", 1);
  await page.goto("./#PT1-rally-1-pat-browser");
  await expect(page.locator("canvas")).toBeVisible();
  await nodeClick(page, t, t.start);
  await expect(page.locator("#match-result")).toContainText("PAT — remis.");
  await expect(page.locator("#turn")).toHaveText("Pojedynek zakończony");
  await expect(page.locator("#penalties")).toContainText("0 pkt");
  await nodeClick(page, t, t.edges[t.start][0]);
  await expect(page.locator("#clicks")).toHaveText("0");
  await expect(page.locator("#opponent-clicks")).toHaveText("0");
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await expect(page.locator("#match-result")).toHaveText("");
});
