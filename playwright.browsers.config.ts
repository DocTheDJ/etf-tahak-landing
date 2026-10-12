import { defineConfig, devices } from "@playwright/test";

// Cross-browser check, run in Docker with Playwright's Linux image (see scripts/test-browsers.sh):
// the three engines on phone viewports, plus a Samsung Internet profile with forced dark mode.
// BASE_URL is required (the live site, or a preview deployment).

const SAMSUNG_UA =
  "Mozilla/5.0 (Linux; Android 15; SM-S931B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/30.0 Chrome/138.0.0.0 Mobile Safari/537.36";

export default defineConfig({
  testDir: "tests/browsers",
  timeout: 60_000,
  workers: 4,
  reporter: [["list"]],
  use: { baseURL: process.env.BASE_URL },
  projects: [
    { name: "chromium-android", use: { ...devices["Pixel 7"] } },
    { name: "webkit-iphone", use: { ...devices["iPhone 15"] } },
    { name: "firefox-mobile", use: { browserName: "firefox", viewport: { width: 390, height: 844 }, hasTouch: true } },
    {
      name: "samsung-light",
      use: { ...devices["Galaxy S9+"], viewport: { width: 384, height: 832 }, deviceScaleFactor: 2.8125, userAgent: SAMSUNG_UA },
    },
    {
      // Samsung Internet's dark mode re-colours websites algorithmically. Chromium's "Auto Dark Mode for Web
      // Contents" is the same mechanism, so this approximates what a Samsung phone in dark mode shows.
      name: "samsung-forced-dark",
      use: {
        ...devices["Galaxy S9+"],
        viewport: { width: 384, height: 832 },
        deviceScaleFactor: 2.8125,
        userAgent: SAMSUNG_UA,
        colorScheme: "dark",
        launchOptions: { args: ["--blink-settings=forceDarkModeEnabled=true"] },
      },
    },
  ],
});
