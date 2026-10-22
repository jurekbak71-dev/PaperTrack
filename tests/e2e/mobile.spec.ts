import { test, expect } from "@playwright/test";
import { generate } from "../../src/generator";

test("telefon: obrót, duże kratki, śledzenie punktu i przesuwanie bez rysowania", async ({
  page,
}, info) => {
  test.skip(info.project.name === "chromium", "Dotyczy urządzeń dotykowych.");
  const t = generate("mobile-camera", "rally", 1),
    p = t.nodes[t.start];
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./#PT1-rally-1-mobile-camera");
  await expect(
    page.getByRole("heading", { name: "Obróć iPhone’a poziomo" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Jak zainstalować grę offline?" })
    .click();
  await expect(page.locator("#install-guide")).toBeVisible();
  await page.getByRole("button", { name: "Zamknij", exact: true }).click();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator(".rotate-screen")).toBeHidden();
  const canvas = page.locator("canvas"),
    box = (await canvas.boundingBox())!;
  expect(box.width).toBeGreaterThan(500);
  expect(box.height).toBeGreaterThan(220);
  expect(await canvas.getAttribute("data-cell")).toBe("36");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator("#clicks")).toHaveText("0");
  const next =
    t.nodes[
      t.edges[t.start].find(
        (id) => t.nodes[id].x === p.x + 1 && t.nodes[id].y === p.y,
      )!
    ];
  expect(next).toBeDefined();
  await page.touchscreen.tap(
    box.x + box.width / 2 + 36,
    box.y + box.height / 2,
  );
  await expect(page.locator("#clicks")).toHaveText("1");
  const view = await canvas.evaluate((c) => ({
    cell: Number(c.dataset.cell),
    x: Number(c.dataset.originX),
    y: Number(c.dataset.originY),
  }));
  expect(view.x + next.x * view.cell).toBeCloseTo(box.width / 2, 0);
  expect(view.y + next.y * view.cell).toBeCloseTo(box.height / 2, 0);
  await expect(page.locator("#turn")).toContainText("Twoja tura");
  const before = await canvas.getAttribute("data-origin-x");
  await page.mouse.move(box.x + 200, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 280, box.y + 100, { steps: 5 });
  await page.mouse.up();
  await expect(canvas).not.toHaveAttribute("data-origin-x", before!);
  await expect(page.locator("#clicks")).toHaveText("1");
  await page.getByRole("button", { name: "Cały tor", exact: true }).click();
  expect(Number(await canvas.getAttribute("data-cell"))).toBeLessThan(10);
  await page.getByRole("button", { name: "Twój punkt", exact: true }).click();
  expect(await canvas.getAttribute("data-cell")).toBe("36");
  await page.setViewportSize({ width: 667, height: 320 });
  const small = (await canvas.boundingBox())!;
  expect(small.width).toBeGreaterThan(450);
  expect(small.height).toBeGreaterThan(140);
  expect(Number(await canvas.getAttribute("data-cell"))).toBeGreaterThanOrEqual(
    28,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  // A distant straight remains one drawing click: pan to its end at full cell size.
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("./#PT1-rally-1-duel-e2e");
  await page.reload();
  await expect(canvas).toBeVisible();
  const farBox = (await canvas.boundingBox())!;
  await page.touchscreen.tap(
    farBox.x + farBox.width / 2,
    farBox.y + farBox.height / 2,
  );
  for (let i = 0; i < 4; i++) {
    await page.mouse.move(
      farBox.x + farBox.width / 2 + 180,
      farBox.y + farBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      farBox.x + farBox.width / 2 - 180,
      farBox.y + farBox.height / 2,
      { steps: 8 },
    );
    await page.mouse.up();
  }
  expect(await canvas.getAttribute("data-cell")).toBe("36");
  await expect(page.locator("#clicks")).toHaveText("0");
  await page.touchscreen.tap(
    farBox.x + farBox.width / 2,
    farBox.y + farBox.height / 2,
  );
  await expect(page.locator("#score")).toHaveText("40");
  await expect(page.locator("#clicks")).toHaveText("1");
});

test("instrukcja instalacji oraz potwierdzona gotowość offline", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .getByRole("button", { name: "Jak zainstalować na iPhonie?" })
    .click();
  const guide = page.locator("#install-guide");
  await expect(guide).toContainText("Safari");
  await expect(guide).toContainText("Do ekranu początkowego");
  await expect(guide.locator("[data-offline]")).toHaveText(
    "Gotowa do gry offline",
  );
  await page.getByRole("button", { name: "Zamknij", exact: true }).click();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        ),
      );
  });
  await page.context().setOffline(true);
  await page.reload();
  await page
    .getByRole("button", { name: "Jak zainstalować na iPhonie?" })
    .click();
  await expect(guide.locator("[data-offline]")).toHaveText(
    "Gotowa do gry offline",
  );
});
