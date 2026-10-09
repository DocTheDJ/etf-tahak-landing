import { expect, test, type Page, type Request } from "@playwright/test";

const AD_PARAMS = "utm_source=meta&utm_medium=paid_social&utm_campaign=etf_tahak";

/** Collect the names of all events the page sends to /api/track. */
function collectEvents(page: Page): Set<string> {
  const names = new Set<string>();
  page.on("request", (r: Request) => {
    if (!r.url().includes("/api/track")) return;
    try { for (const e of JSON.parse(r.postData() ?? "{}").events ?? []) names.add(e.n); } catch {}
  });
  return names;
}

/** Astro removes the `ssr` attribute from an island once Vue has hydrated it; clicks before that do nothing. */
async function hydrated(page: Page, component: string) {
  await page.locator(`astro-island[component-url*="${component}"]:not([ssr])`).first().waitFor({ state: "attached" });
}

async function noHorizontalScroll(page: Page) {
  const [doc, view] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  expect(doc).toBeLessThanOrEqual(view);
}

test("ad A (fees): calculator first, typo fix, sign-up unlocks the table", async ({ page }) => {
  const events = collectEvents(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`/?${AD_PARAMS}&utm_content=fees-feed`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kolik vám sežerou poplatky?");
  await expect(page.locator(".big")).toHaveText(/−466\s000\sKč/); // the ad's number, before any tap
  await noHorizontalScroll(page);

  await hydrated(page, "Calculator");
  await page.getByRole("button", { name: "10 000", exact: true }).click();
  await expect(page.locator(".big")).toHaveText(/−932\s000\sKč/);

  // the table shows 6 of 12; 3 twins open (the ones from the ad), the rest locked
  await page.locator("#srovnani").scrollIntoViewIfNeeded();
  await hydrated(page, "EtfTable");
  await expect(page.locator(".etfs > li")).toHaveCount(6);
  await expect(page.locator(".twin--locked")).toHaveCount(3);
  await expect(page.locator(".unlock.sheen")).toHaveCount(3); // light sweep on every 🔒 button
  await page.getByRole("button", { name: /Ukázat dalších 6 ETF/ }).click();
  await expect(page.locator(".etfs > li")).toHaveCount(12);

  // typo suggestion, accept it, submit
  await hydrated(page, "LeadForm");
  const form = page.locator('form[data-loc="calculator"]');
  // empty: a light runs around the field; the button is calm
  await expect(form.locator(".field")).toHaveClass(/field--run/);
  await expect(form.getByRole("button", { name: "Chci tahák →" })).not.toHaveClass(/sheen/);
  await form.getByRole("textbox").fill("jana.novakova@sezanm.cz");
  // valid address: solid lime field with a check, the sweep moves to the button
  await expect(form.locator(".field")).toHaveClass(/field--ok/);
  await expect(form.locator(".check")).toBeVisible();
  await expect(form.getByRole("button", { name: "Chci tahák →" })).toHaveClass(/sheen/);
  await form.getByRole("button", { name: "Chci tahák →" }).click();
  await expect(form.locator(".field")).toHaveClass(/field--err/); // the typo hint turns the field coral
  await form.getByRole("button", { name: "jana.novakova@seznam.cz" }).click();
  await expect(form.getByRole("textbox")).toHaveValue("jana.novakova@seznam.cz");
  await form.getByRole("button", { name: "Chci tahák →" }).click();

  await expect(page.getByText("Tahák je váš.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Stáhnout tahák \(PDF/ })).toHaveAttribute("href", "/tahak/etf-tahak-2026.pdf");
  await expect(page.locator(".twin--locked")).toHaveCount(0);
  await page.locator("#tahak").scrollIntoViewIfNeeded(); // the final form hydrates when visible
  await expect(page.locator("form[data-loc]")).toHaveCount(0); // ...and becomes "Tahák už máte" too

  // marketing consent: a separate, explicit opt-in after the PDF is delivered (never pre-selected)
  await expect(page.getByText("Chcete k taháku i 4 krátké tipy e-mailem?")).toBeVisible();
  const consentRequest = page.waitForRequest((r) => r.url().includes("/api/lead") && r.method() === "PATCH" && (r.postData() ?? "").includes("consent"));
  await page.getByRole("button", { name: "Ano, chci tipy" }).click();
  const sent = JSON.parse((await consentRequest).postData() ?? "{}");
  expect(sent.consent).toMatchObject({ granted: true, version: expect.stringMatching(/^tips-/) });
  await expect(page.getByText("Díky! První tip dorazí do pár dní.")).toBeVisible();

  await page.getByRole("button", { name: "5–15 tisíc" }).click();
  await expect(page.getByText("Díky! Pomůže nám to tahák vylepšovat.")).toBeVisible();

  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect.poll(() => [...events], { timeout: 8000 }).toEqual(
    expect.arrayContaining(["lp_view", "calc_interact", "table_expand", "form_start", "form_error", "typo_accepted", "form_submit", "lead_submitted", "optin_given", "profile_answer"]),
  );
  expect(errors).toEqual([]);
});

test("ad B (twins): the ad's pairs first, sign-up in the hero", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`/dvojcata?${AD_PARAMS}&utm_content=twins-feed`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("VOO z Česka nekoupíte. Jeho dvojče ano.");
  for (const twin of ["VUAA", "SPYL", "VWCE"]) await expect(page.locator(".book")).toContainText(twin);
  await noHorizontalScroll(page);

  await hydrated(page, "LeadForm");
  const form = page.locator('form[data-loc="hero_twins"]');
  await form.getByRole("textbox").fill("petr@email.cz");
  await form.getByRole("button", { name: "Chci je →" }).click();
  await expect(page.getByText("Tahák je váš.")).toBeVisible();
  expect(errors).toEqual([]);
});

test("returning visitor is not asked again", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("lead", "abc"));
  await page.reload();
  await page.locator("#tahak").scrollIntoViewIfNeeded(); // hydrate the final form too
  await expect(page.locator("form[data-loc]")).toHaveCount(0);
  await expect(page.getByText("Tahák už máte ✓").first()).toBeVisible();
});

test("lead API validates input", async ({ request }) => {
  expect((await request.post("/api/lead", { data: { email: "nope" } })).status()).toBe(422);
  const ok = await request.post("/api/lead", { data: { email: "test@seznam.cz", loc: "api-test", ctx: { v: "fees" } } });
  expect(ok.status()).toBe(200);
  const lead = await ok.json();
  expect(lead).toMatchObject({ ok: true });

  // consent is accepted only for wording we know we showed
  expect((await request.patch("/api/lead", { data: { id: lead.id, consent: { granted: true, version: "made-up" } } })).status()).toBe(400);
  expect((await request.patch("/api/lead", { data: { id: lead.id, email: "test@seznam.cz", consent: { granted: true, version: "tips-2026-10-09" } } })).status()).toBe(200);
});

test("decline keeps the PDF and sends nothing else", async ({ page }) => {
  await page.goto("/dvojcata");
  await page.locator('astro-island[component-url*="LeadForm"]:not([ssr])').first().waitFor({ state: "attached" });
  const form = page.locator('form[data-loc="hero_twins"]');
  await form.getByRole("textbox").fill("eva@email.cz");
  await form.getByRole("button", { name: "Chci je →" }).click();
  let consentSent = false;
  page.on("request", (r) => { if (r.method() === "PATCH" && (r.postData() ?? "").includes("consent")) consentSent = true; });
  await page.getByRole("button", { name: "Ne, stačí mi PDF" }).click();
  await expect(page.getByText("Dobře, žádné další e-maily. Tahák už máte.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Stáhnout tahák/ })).toBeVisible();
  expect(consentSent).toBe(false);
});
