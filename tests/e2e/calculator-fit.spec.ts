import { expect, test, type Page } from "@playwright/test";

// The loss number must never wrap ("Kč" dropping to a second line) and never overflow its card,
// at any phone width, including the longest value the calculator can produce.

const WIDTHS = [320, 360, 390, 430, 1280];

async function setWorstCase(page: Page) {
  await page.locator('astro-island[component-url*="Calculator"]:not([ssr])').waitFor({ state: "attached" });
  await page.getByRole("button", { name: "20 000", exact: true }).click();
  await page.getByRole("button", { name: "30 let", exact: true }).click();
  await page.locator("#fee").fill("3"); // slider maximum → −9 384 000 Kč, the longest result
  await expect(page.locator(".big")).toHaveText(/−9\s384\s000\sKč/);
}

/** One line and inside its box: height of a single line, no horizontal overflow. */
async function assertFits(page: Page, selector: string, box: string) {
  const m = await page.evaluate(([sel, boxSel]) => {
    const el = document.querySelector(sel) as HTMLElement;
    const container = el.closest(boxSel) as HTMLElement;
    const r = el.getBoundingClientRect();
    const c = container.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(el);
    const lines = new Set([...range.getClientRects()].map((x) => Math.round(x.top))).size;
    return { lines, right: Math.max(r.right, range.getBoundingClientRect().right), boxRight: c.right, overflow: el.scrollWidth - el.clientWidth };
  }, [selector, box] as const);
  expect(m.lines, `${selector} wraps onto ${m.lines} lines`).toBe(1);
  expect(m.overflow, `${selector} overflows its own box`).toBeLessThanOrEqual(0);
  expect(m.right, `${selector} sticks out of ${box}`).toBeLessThanOrEqual(m.boxRight + 0.5);
}

for (const width of WIDTHS) {
  test(`calculator result stays on one line at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await assertFits(page, ".big", ".result"); // default value
    await setWorstCase(page);
    await assertFits(page, ".big", ".result");
    for (const i of [1, 2]) await assertFits(page, `.bar:nth-child(${i}) .val`, ".result");
  });
}
