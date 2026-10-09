import { expect, test } from "./fixtures";

// PostHog runs cookieless through our own domain. The local test server is started with a dummy key
// (playwright.config.ts); production only has PostHog once PUBLIC_POSTHOG_KEY is set, so skip there.
test.skip(!!process.env.BASE_URL, "PostHog key is only set for the local test server");

test("PostHog: funnel events go through the /rq7 proxy, nothing is stored on the device", async ({ page, posthog }) => {
  await page.goto("/?utm_source=meta&utm_medium=paid_social&utm_campaign=etf_tahak&utm_content=fees-feed");

  // loads after the page is interactive, then sends the pageview and the queued lp_view
  await expect.poll(() => posthog.events(), { timeout: 15_000 }).toEqual(expect.arrayContaining(["$pageview", "lp_view"]));

  await page.locator('astro-island[component-url*="Calculator"]:not([ssr])').waitFor({ state: "attached" });
  await page.getByRole("button", { name: "10 000", exact: true }).click();
  await expect.poll(() => posthog.events(), { timeout: 15_000 }).toEqual(expect.arrayContaining(["calc_interact", "calc_change"]));

  // every request went to our own domain, none straight to posthog.com
  expect(posthog.requests().length).toBeGreaterThan(0);
  for (const url of posthog.requests()) expect(new URL(url).pathname.startsWith("/rq7/")).toBe(true);

  // cookieless: no PostHog cookie and no PostHog keys in local/session storage
  const stored = await page.evaluate(() => ({
    cookies: document.cookie,
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
  }));
  expect(stored.cookies).not.toMatch(/ph_|posthog/i);
  expect([...stored.local, ...stored.session].filter((k) => /ph_|posthog/i.test(k))).toEqual([]);
});

test("PostHog: events carry the ad context (variant, UTM)", async ({ page }) => {
  const bodies: string[] = [];
  page.on("request", (r) => { if (r.url().includes("/rq7/") && r.method() === "POST") bodies.push(r.postData() ?? ""); });
  await page.goto("/dvojcata?utm_source=meta&utm_content=twins-story");
  await expect.poll(() => bodies.join("\n"), { timeout: 15_000 }).toContain('"lp_view"');
  const all = bodies.join("\n");
  expect(all).toContain('"utm_content":"twins-story"');
  expect(all).toContain('"v":"twins"');
});
