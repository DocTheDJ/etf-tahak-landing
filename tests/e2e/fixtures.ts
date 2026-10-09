import { test as base, expect } from "@playwright/test";

// Every e2e test runs with the PostHog proxy path (/rq7) intercepted:
// - tests never send events to the real PostHog project (also when run against production),
// - the captured requests let tests assert what PostHog would have received.
export const test = base.extend<{ posthog: { events: () => string[]; requests: () => string[] } }>({
  posthog: [
    async ({ page }, use) => {
      const urls: string[] = [];
      const bodies: string[] = [];
      await page.route("**/rq7/**", async (route) => {
        const req = route.request();
        urls.push(req.url());
        if (req.method() === "POST") bodies.push(req.postData() ?? "");
        if (/\.js(\?|$)/.test(req.url())) return route.fulfill({ status: 200, contentType: "text/javascript", body: "" });
        const body = req.url().includes("/flags") ? '{"featureFlags":{},"errorsWhileComputingFlags":false}' : '{"status":1}';
        return route.fulfill({ status: 200, contentType: "application/json", body });
      });
      await use({
        events: () => bodies.flatMap((b) => [...b.matchAll(/"event"\s*:\s*"([^"]+)"/g)].map((m) => m[1])),
        requests: () => urls,
      });
    },
    { auto: true },
  ],
});

export { expect };
