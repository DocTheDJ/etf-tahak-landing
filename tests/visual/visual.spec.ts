import { expect, test, type Page } from "@playwright/test";

// Pixel snapshots of every page and every interactive state, to prove styling refactors change nothing.
//   npm run test:visual            compare against the saved baseline
//   npm run test:visual -- -u      re-record the baseline (only after an intended visual change)
// Snapshots are OS/font specific, so they're kept local (gitignored) and not run in CI.

test.beforeEach(async ({ page }) => {
  await page.route("**/rq7/**", (r) => r.fulfill({ status: 200, body: "{}" })); // no PostHog traffic
});

/** Hydrate every island (they load when scrolled into view), then go back to the top. */
async function settle(page: Page) {
  // smooth scrolling would keep moving sticky elements between captures
  await page.addStyleTag({ content: "html { scroll-behavior: auto !important; }" });
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 500) {
    await page.evaluate((yy) => window.scrollTo({ top: yy, behavior: "instant" }), y);
    await page.waitForTimeout(60);
  }
  await page.waitForFunction(() => document.querySelectorAll("astro-island[ssr]").length === 0, null, { timeout: 15_000 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
}

const shot = { fullPage: true, animations: "disabled" as const, maxDiffPixelRatio: 0.002 };
// element shots: hide the pinned ticker and the sticky bar, which overlap elements depending on scroll position
const el = { animations: "disabled" as const, maxDiffPixelRatio: 0.002 };
async function hideOverlays(page: Page) {
  await page.addStyleTag({ content: '[data-testid="ticker"], [data-testid="sticky-cta"] { visibility: hidden !important; }' });
}

for (const width of [390, 1280]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 844 } });

    test("fees page", async ({ page }) => {
      await page.goto("/");
      await settle(page);
      await page.mouse.move(1, 1);
      await expect(page).toHaveScreenshot(`fees-${width}.png`, shot);
    });

    test("twins page", async ({ page }) => {
      await page.goto("/dvojcata");
      await settle(page);
      await page.mouse.move(1, 1);
      await expect(page).toHaveScreenshot(`twins-${width}.png`, shot);
    });

    test("privacy page", async ({ page }) => {
      await page.goto("/ochrana-udaju");
      await settle(page);
      await page.mouse.move(1, 1);
      await expect(page).toHaveScreenshot(`privacy-${width}.png`, shot);
    });
  });
}

test.describe("390px states", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("calculator worst case + valid email + typo", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    await page.getByRole("button", { name: "20 000", exact: true }).click();
    await page.getByRole("button", { name: "30 let", exact: true }).click();
    await page.locator("#fee").fill("3");
    const form = page.locator('form[data-loc="calculator"]');
    await form.getByRole("textbox").fill("jana@seznam.cz");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(400); // sticky bar slides away
    await page.mouse.move(1, 1);
    await expect(page).toHaveScreenshot("state-calc-valid.png", shot);
    await form.getByRole("textbox").fill("jana@sezanm.cz");
    await form.getByRole("button", { name: "Chci tahák →" }).click();
    await hideOverlays(page);
    await page.mouse.move(1, 1);
    await expect(form).toHaveScreenshot("state-form-typo.png", el);
    await form.getByRole("textbox").fill("");
    await form.getByRole("button", { name: "Chci tahák →" }).click();
    await hideOverlays(page);
    await page.mouse.move(1, 1);
    await expect(form).toHaveScreenshot("state-form-empty-error.png", el);
  });

  test("table filters, sort, expanded", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    await page.locator("#srovnani").scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: "výnos 10 let" }).click();
    await page.getByRole("button", { name: /Ukázat dalších/ }).click();
    await hideOverlays(page);
    await page.mouse.move(1, 1);
    await expect(page.locator("#srovnani")).toHaveScreenshot("state-table-sorted-expanded.png", el);
    await page.getByRole("button", { name: "Dividendy" }).click();
    await hideOverlays(page);
    await page.mouse.move(1, 1);
    await expect(page.locator("#srovnani")).toHaveScreenshot("state-table-dividends.png", el);
  });

  test("faq open", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    for (const q of await page.locator("details summary").all()) await q.click();
    await hideOverlays(page);
    await page.mouse.move(1, 1);
    await expect(page.locator("#otazky")).toHaveScreenshot("state-faq-open.png", el);
  });

  test("thank-you, opt-in, profile answered, unlocked table", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    const form = page.locator('form[data-loc="calculator"]');
    await form.getByRole("textbox").fill("jana@seznam.cz");
    await form.getByRole("button", { name: "Chci tahák →" }).click();
    await page.getByText("Tahák je váš.").waitFor();
    await page.waitForTimeout(800);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.mouse.move(1, 1);
    await expect(page).toHaveScreenshot("state-thankyou.png", shot);
    await page.getByRole("button", { name: "Ano, chci tipy" }).click();
    await page.getByRole("button", { name: "5–15 tisíc" }).click();
    await page.getByText("Díky! Pomůže nám to").waitFor();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.mouse.move(1, 1);
    await expect(page).toHaveScreenshot("state-thankyou-answered.png", shot);
  });

  test("returning visitor", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("lead", "abc"));
    await page.reload();
    await settle(page);
    await page.mouse.move(1, 1);
    await expect(page).toHaveScreenshot("state-returning.png", shot);
  });

  test("twins hero sign-up declined", async ({ page }) => {
    await page.goto("/dvojcata");
    await settle(page);
    const form = page.locator('form[data-loc="hero_twins"]');
    await form.getByRole("textbox").fill("eva@email.cz");
    await form.getByRole("button", { name: "Chci je →" }).click();
    await page.getByRole("button", { name: "Ne, stačí mi PDF" }).click();
    await page.getByText("Dobře, žádné další e-maily.").waitFor();
    await page.waitForTimeout(800);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.mouse.move(1, 1);
    await expect(page).toHaveScreenshot("state-twins-declined.png", shot);
  });

  test("sticky bar visible mid-page", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    await page.locator("#srovnani").scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(500);
    await page.mouse.move(1, 1);
    await expect(page).toHaveScreenshot("state-sticky.png", el);
  });
});
