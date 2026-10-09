import { defineConfig, devices } from "@playwright/test";

// End-to-end: the real journey from ad click to lead, on a phone-sized viewport, for both ad variants.
// Uses the installed Chrome (no browser download). `npm run test:e2e` starts the dev server itself.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",
  use: {
    ...devices["Pixel 7"],
    channel: "chrome",
    baseURL: process.env.BASE_URL ?? "http://localhost:4321",
  },
  webServer: process.env.BASE_URL
    ? undefined
    : { command: "npm run dev -- --port 4321", url: "http://localhost:4321", reuseExistingServer: !process.env.CI, timeout: 60_000 },
});
