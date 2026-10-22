import { test, expect, type Page } from "@playwright/test";
import { generate, type Track } from "../../src/generator";
import { solve } from "../../src/solver";

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

test("kliknięcia, pełny tor, optimum, rekord i offline", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const track = generate("e2e", "oval", 1),
    solution = solve(track);
  await page.goto("./#PT1-oval-1-e2e");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByText("Pokaż najlepszą trasę")).toHaveCount(0);
  await expect(page.locator(".click-help")).toContainText(
    "Jeden klik = jedna kratka",
  );
  await nodeClick(page, track, track.start);
  await expect(page.locator("#status")).toContainText("START wybrany");
  await expect(page.locator("#length")).toHaveText("0,00");
  for (const next of solution.path.slice(1)) await nodeClick(page, track, next);
  await expect(page.locator("#result")).toContainText("Meta! ★★★");
  await page.getByRole("button", { name: "Pokaż najlepszą trasę" }).click();
  await page.getByRole("button", { name: "Zagraj ponownie" }).click();
  await expect(page.locator("#length")).toHaveText("0,00");
  await expect(page.locator("#status")).toContainText(
    "Kliknij czerwony punkt START",
  );
  await page.getByRole("button", { name: "← Menu" }).click();
  await page.getByRole("button", { name: "Moje rekordy" }).click();
  await expect(page.locator("#app")).toContainText("PT1-oval-1-e2e");
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
  await nodeClick(page, track, solution.path[1]);
  await expect(page.locator("#length")).not.toHaveText("0,00");
  expect(errors).toEqual([]);
});

test("kampania, kod i responsywny układ", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Kampania", exact: true }).click();
  await expect(page.locator("[data-level]")).toHaveCount(100);
  await page.locator('[data-level="100"]').click();
  await expect(page.locator("canvas")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator("canvas")).toBeVisible();
});

test("odrzuca skoki, ponowny klik, przeciąganie i anulowany gest; cofa odcinki", async ({
  page,
}) => {
  const track = generate("gest", "rally", 3),
    solution = solve(track);
  await page.goto("./#PT1-rally-3-gest");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  await nodeClick(page, track, solution.path[1]);
  await expect(page.locator("#status")).toContainText("Najpierw kliknij");
  await expect(page.locator("#length")).toHaveText("0,00");
  await nodeClick(page, track, track.start);
  const far = solution.path.find(
    (id) =>
      Math.max(
        Math.abs(track.nodes[id].x - track.nodes[track.start].x),
        Math.abs(track.nodes[id].y - track.nodes[track.start].y),
      ) > 1,
  )!;
  await nodeClick(page, track, far);
  await expect(page.locator("#status")).toContainText("Za daleko");
  await expect(page.locator("#length")).toHaveText("0,00");
  await nodeClick(page, track, track.start);
  await expect(page.locator("#length")).toHaveText("0,00");
  const box = (await canvas.boundingBox())!,
    start = track.nodes[track.start],
    next = track.nodes[solution.path[1]];
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
  await expect(page.locator("#length")).toHaveText("0,00");
  await expect(page.locator("#status")).toContainText(
    "Przeciąganie nie dodaje",
  );
  await page.mouse.move(
    box.x + (next.x / 52) * box.width,
    box.y + (next.y / 52) * box.width,
  );
  await page.mouse.down();
  await canvas.dispatchEvent("pointercancel", {
    pointerId: 1,
    isPrimary: true,
  });
  await page.mouse.up();
  await expect(page.locator("#length")).toHaveText("0,00");
  await nodeClick(page, track, solution.path[1]);
  const length = Math.hypot(start.x - next.x, start.y - next.y)
    .toFixed(2)
    .replace(".", ",");
  await expect(page.locator("#length")).toHaveText(length);
  await nodeClick(page, track, solution.path[2]);
  await page.getByRole("button", { name: "Cofnij", exact: true }).click();
  await expect(page.locator("#length")).toHaveText(length);
  await page.getByRole("button", { name: "Cofnij 5" }).click();
  await expect(page.locator("#length")).toHaveText("0,00");
  const outside = track.nodes[track.start];
  const bad = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ]
    .map(([x, y]) => ({ x: outside.x + x, y: outside.y + y }))
    .find(
      (p) =>
        !track.edges[track.start].some(
          (id) => track.nodes[id].x === p.x && track.nodes[id].y === p.y,
        ),
    )!;
  await pointClick(page, bad);
  await expect(page.locator("#status")).toContainText("wychodzi poza tor");
  await expect(page.locator("#length")).toHaveText("0,00");
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await nodeClick(page, track, solution.path[1]);
  await expect(page.locator("#status")).toContainText("Najpierw kliknij");
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
  await expect(page.locator("#length")).not.toHaveText("0,00");
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
