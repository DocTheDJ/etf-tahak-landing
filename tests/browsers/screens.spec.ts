import { expect, test, type Page } from "@playwright/test";

// Screenshots of the key screens in every browser project, saved for side-by-side review
// (test-results/browsers/<project>/<screen>.png), plus checks that hold in every engine.

test.beforeEach(async ({ page }) => {
  await page.route("**/rq7/**", (r) => r.fulfill({ status: 200, body: "{}" })); // never send test traffic to PostHog
});

async function shot(page: Page, name: string, project: string) {
  await page.waitForTimeout(600);
  await page.screenshot({ path: `test-results/browsers/${project}/${name}.png`, animations: "disabled" });
}

async function hydrated(page: Page, component: string) {
  await page.locator(`astro-island[component-url*="${component}"]:not([ssr])`).first().waitFor({ state: "attached", timeout: 20_000 });
}

async function noHorizontalScroll(page: Page) {
  const [doc, view] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  expect(doc, "page wider than the screen").toBeLessThanOrEqual(view);
}

test("fees page: first screen, calculator, table", async ({ page }, info) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await noHorizontalScroll(page);
  await shot(page, "1-fees-first-screen", info.project.name);

  await hydrated(page, "Calculator");
  await page.getByRole("button", { name: "20 000", exact: true }).click();
  await page.getByRole("button", { name: "30 let", exact: true }).click();
  await page.getByTestId("calc-result").scrollIntoViewIfNeeded();
  await expect(page.getByTestId("loss")).toHaveText(/−6\s492\s000\sKč/);
  // the loss number stays on one line in every engine
  const lines = await page.getByTestId("loss").evaluate((el) => {
    const r = document.createRange(); r.selectNodeContents(el);
    return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size;
  });
  expect(lines).toBe(1);
  await shot(page, "2-calculator-result", info.project.name);

  const form = page.locator('form[data-loc="calculator"]');
  await form.scrollIntoViewIfNeeded();
  await form.getByRole("textbox").fill("jana@seznam.cz");
  await expect(form.locator("[data-state]")).toHaveAttribute("data-state", "ok");
  await shot(page, "3-form-valid", info.project.name);

  await page.locator("#srovnani").scrollIntoViewIfNeeded();
  await hydrated(page, "EtfTable");
  await expect(page.getByTestId("etf-row")).toHaveCount(6);
  await shot(page, "4-table", info.project.name);
});

test("twins page: first screen", async ({ page }, info) => {
  await page.goto("/dvojcata");
  await page.evaluate(() => document.fonts.ready);
  await noHorizontalScroll(page);
  for (const twin of ["VUAA", "SPYL", "VWCE"]) await expect(page.getByTestId("pairs")).toContainText(twin);
  await shot(page, "5-twins-first-screen", info.project.name);
});
