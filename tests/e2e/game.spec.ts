import { test, expect } from "@playwright/test";
import { generate } from "../../src/generator";
import { solve } from "../../src/solver";
test("rysowanie, ukończenie, optimum, rekord i offline", async ({
  page,
  browserName,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const track = generate("e2e", "oval", 1),
    solution = solve(track);
  await page.goto("./#PT1-oval-1-e2e");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  await expect(page.getByText("Pokaż najlepszą trasę")).toHaveCount(0);
  const box = (await canvas.boundingBox())!;
  const pos = (n: number) => ({
    x: box.x + (track.nodes[n].x / 52) * box.width,
    y: box.y + (track.nodes[n].y / 52) * box.width,
  });
  if (
    browserName === "chromium" &&
    !test.info().project.name.match(/iphone|ipad/)
  ) {
    const p = pos(track.start);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    for (const n of solution.path.slice(1)) {
      const p = pos(n);
      await page.mouse.move(p.x, p.y);
    }
    await page.mouse.up();
  } else {
    // Dispatch real PointerEvent semantics with touch pointer type in WebKit.
    await canvas.evaluate(
      (element, args) => {
        const r = element.getBoundingClientRect(),
          p = args.nodes[args.path[0]];
        const fire = (type: string, p: { x: number; y: number }) =>
          element.dispatchEvent(
            new PointerEvent(type, {
              pointerId: 9,
              pointerType: "touch",
              isPrimary: true,
              bubbles: true,
              clientX: r.x + (p.x / 52) * r.width,
              clientY: r.y + (p.y / 52) * r.width,
              buttons: type === "pointerup" ? 0 : 1,
            }),
          );
        const original = element.setPointerCapture;
        element.setPointerCapture = () => {};
        fire("pointerdown", p);
        for (const id of args.path.slice(1))
          fire("pointermove", args.nodes[id]);
        fire("pointerup", args.nodes[args.path.at(-1)!]);
        element.setPointerCapture = original;
      },
      { nodes: track.nodes, path: solution.path },
    );
  }
  await expect(page.locator("#result")).toContainText("Meta! ★★★");
  await page.getByText("Pokaż najlepszą trasę").click();
  await page.getByRole("button", { name: "Zagraj ponownie" }).click();
  await expect(page.locator("#length")).toHaveText("0,00");
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
  await page.getByRole("button", { name: "← Menu" }).click();
  await expect(page.getByRole("button", { name: "Nowa gra" })).toBeVisible();
  await page.getByRole("button", { name: "Nowa gra" }).click();
  await expect(page.locator("canvas")).toBeVisible();
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

test("anulowanie dotyku, wznowienie, cofanie i blokowanie krawędzi", async ({
  page,
}) => {
  const track = generate("gest", "rally", 3),
    solution = solve(track);
  await page.goto("./#PT1-rally-3-gest");
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  await canvas.evaluate(
    (element, args) => {
      const r = element.getBoundingClientRect();
      element.setPointerCapture = () => {};
      const fire = (type: string, id: number) => {
        const p = args.nodes[id];
        element.dispatchEvent(
          new PointerEvent(type, {
            pointerId: 21,
            pointerType: "touch",
            bubbles: true,
            clientX: r.x + (p.x / 52) * r.width,
            clientY: r.y + (p.y / 52) * r.width,
          }),
        );
      };
      fire("pointerdown", args.path[0]);
      fire("pointermove", args.path[1]);
      fire("pointermove", args.path[2]);
      fire("pointercancel", args.path[2]);
      fire("pointermove", args.path[3]); // Cancelled gesture must not draw.
    },
    { nodes: track.nodes, path: solution.path },
  );
  const expected = track.nodes[solution.path[0]],
    p1 = track.nodes[solution.path[1]],
    p2 = track.nodes[solution.path[2]];
  const length =
    Math.hypot(expected.x - p1.x, expected.y - p1.y) +
    Math.hypot(p1.x - p2.x, p1.y - p2.y);
  await expect(page.locator("#length")).toHaveText(
    length.toFixed(2).replace(".", ","),
  );
  await canvas.evaluate(
    (element, args) => {
      const r = element.getBoundingClientRect();
      const fire = (type: string, id: number) => {
        const p = args.nodes[id];
        element.dispatchEvent(
          new PointerEvent(type, {
            pointerId: 22,
            pointerType: "touch",
            bubbles: true,
            clientX: r.x + (p.x / 52) * r.width,
            clientY: r.y + (p.y / 52) * r.width,
          }),
        );
      };
      fire("pointerdown", args.path[2]);
      fire("pointermove", args.path[3]);
      fire("pointerup", args.path[3]);
    },
    { nodes: track.nodes, path: solution.path },
  );
  await page.getByRole("button", { name: "Cofnij", exact: true }).click();
  await expect(page.locator("#length")).toHaveText(
    length.toFixed(2).replace(".", ","),
  );
  await page.getByRole("button", { name: "Cofnij 5" }).click();
  await expect(page.locator("#length")).toHaveText("0,00");
  await canvas.evaluate((element, p) => {
    const r = element.getBoundingClientRect();
    for (const [type, x, y] of [
      ["pointerdown", p.x, p.y],
      ["pointermove", 0, 0],
      ["pointerup", 0, 0],
    ] as const)
      element.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 23,
          pointerType: "touch",
          bubbles: true,
          clientX: r.x + (x / 52) * r.width,
          clientY: r.y + (y / 52) * r.width,
        }),
      );
  }, track.nodes[track.start]);
  await expect(page.locator("#status")).toContainText("Krawędź toru");
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
