// Guard against build tooling leaking into the Vercel function bundle.
// @astrojs/vercel 11.0.13 bundled `import "rolldown"` into the server entry, which crashes every API route at
// runtime (FUNCTION_INVOCATION_FAILED: "Cannot find native binding"). Run after `npm run build`; CI does.
import { readFile } from "node:fs/promises";

const entry = ".vercel/output/functions/_render.func/.vercel/output/server/entry.mjs";
const code = await readFile(entry, "utf8").catch(() => {
  console.error(`check-function: ${entry} not found, run npm run build first`);
  process.exit(1);
});
const forbidden = ["rolldown", "vite", "esbuild"].filter((m) => new RegExp(`^import ["']${m}["'];?$|from ["']${m}["']`, "m").test(code));
if (forbidden.length) {
  console.error(`check-function: server entry imports build tooling: ${forbidden.join(", ")}`);
  process.exit(1);
}
console.log("check-function: ok");
