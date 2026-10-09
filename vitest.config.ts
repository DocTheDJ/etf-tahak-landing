import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit tests for the plain TypeScript logic in src/lib (no Astro, no browser).
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["tests/unit/**/*.test.ts"] },
});
