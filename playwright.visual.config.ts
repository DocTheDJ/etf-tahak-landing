import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Visual regression (local only): see tests/visual/visual.spec.ts.
export default defineConfig({
  ...base,
  testDir: "tests/visual",
  fullyParallel: false,
  workers: 2,
  snapshotPathTemplate: "tests/visual/__snapshots__/{arg}{ext}",
  use: { ...base.use, deviceScaleFactor: 1 },
});
