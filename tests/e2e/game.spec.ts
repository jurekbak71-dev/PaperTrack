import { solve } from "../../src/solver";
import { Game } from "../../src/game";
import { test, expect, type Page } from "@playwright/test";
import { generate, type Track } from "../../src/generator";
import { opponentTrack } from "../../src/game/duel";

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
  let box = (await page.locator("canvas").boundingBox())!;
  let y = box.y + (((p.y + pan.y - 26) * zoom + 26) / 52) * box.width;
  const height = page.viewportSize()!.height;
  if (y < 20 || y > height - 20) {
    await page.evaluate((delta) => window.scrollBy(0, delta), y - height / 2);
    box = (await page.locator("canvas").boundingBox())!;
    y = box.y + (((p.y + pan.y - 26) * zoom + 26) / 52) * box.width;
  }
  const x = box.x + (((p.x + pan.x - 26) * zoom + 26) / 52) * box.width;
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
  await expect(page.locator("#match-result")).toContainText(
    "Wygrywa przeciwnik",
    { timeout: 15000 },
  );
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
  await expect(page.locator(".eyebrow").last()).toContainText("Trudność 5/5");
  await expect(page.locator(".eyebrow").last()).toContainText("4.00 kr.");
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
  await pointClick(page, { x: start.x + 3, y: start.y });
  await expect(page.locator("#score")).toHaveText("3");
  await expect(page.locator("#clicks")).toHaveText("1");
  await expect(page.locator("#opponent-clicks")).toHaveText("2");
  await page.getByRole("button", { name: "Cofnij", exact: true }).click();
  await expect(page.locator("#score")).toHaveText("0");
  await expect(page.locator("#opponent-clicks")).toHaveText("1");
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
    red = opponentTrack(track),
    start = track.nodes[track.start],
    contact = track.nodes[red.start];
  expect(
    Math.max(Math.abs(contact.x - start.x), Math.abs(contact.y - start.y)),
  ).toBe(1);
  await page.goto("./#PT1-rally-1-duel-e2e");
  await expect(page.locator("canvas")).toBeVisible();
  await pointClick(page, start);
  await pointClick(page, contact);
  await expect(page.locator("#status")).toContainText("Odbicie");
  await expect(page.locator("#opponent-clicks")).toHaveText("1");
  await expect(page.locator("#turn")).toContainText("Twoja tura");
  const wrong = { x: contact.x + 1, y: contact.y };
  await pointClick(page, wrong);
  await expect(page.locator("#status")).toContainText("przeciwny");
  await expect(page.locator("#penalties")).toContainText("-1 pkt");
  await expect(page.locator("#opponent-clicks")).toHaveText("2");
  await expect(page.locator("#turn")).toContainText("Twoja tura");
  await pointClick(page, start);
  await expect(page.locator("#clicks")).toHaveText("2");
  await expect(page.locator("#score")).toHaveText("1");
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
  await page.mouse.move(
    box.x + (start.x / 52) * box.width,
    box.y + (start.y / 52) * box.width,
  );
  await page.mouse.down();
  await page.mouse.move(
    box.x + (next.x / 52) * box.width,
    box.y + (next.y / 52) * box.width,
  );
  await page.mouse.up();
  await expect(page.locator("#clicks")).toHaveText("0");
  await expect(page.locator("#status")).toContainText(
    "Przeciąganie nie dodaje",
  );
  await page.mouse.move(
    box.x + (next.x / 52) * box.width,
    box.y + (next.y / 52) * box.width,
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
  await page
    .getByRole("button", { name: "Przesuń w prawo", exact: true })
    .click();
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
