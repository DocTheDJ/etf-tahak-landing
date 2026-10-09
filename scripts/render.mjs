// Builds the lead magnet and the ad creatives from the live data, using headless Chrome/Edge.
//
//   npm run render
//
// Sources (marketing/)                       ->  Outputs (public/, deployed as static files)
//   tahak/template.mjs + src/data/etfs.json  ->  tahak/etf-tahak-2026.pdf           (the cheat sheet, 2× A4)
//   ads/ad-fees.html   (?f=feed | ?f=story)  ->  ads/ad-fees-feed.png, ad-fees-story.png
//   ads/ad-twins.html  (?f=feed | ?f=story)  ->  ads/ad-twins-feed.png, ad-twins-story.png
//   ads/og.html                              ->  img/og.png                          (link preview image)
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import { renderTahak } from "../marketing/tahak/template.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const pub = (...p) => join(root, "public", ...p);
const src = (...p) => join(root, "marketing", ...p);

const CHROME = [
  process.env.CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].find((p) => p && existsSync(p));
if (!CHROME) throw new Error("No Chrome/Edge found. Set CHROME=/path/to/chrome");

function chrome(args) {
  execFileSync(
    CHROME,
    [
      ...(process.env.CI ? ["--no-sandbox"] : []),
      "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
      "--run-all-compositor-stages-before-draw", "--virtual-time-budget=8000",
      ...args,
    ],
    { stdio: "pipe" },
  );
}
const fileUrl = (p, query = "") => pathToFileURL(p).href + query;

// ------------------------------------------------------------------ cheat sheet PDF
const data = JSON.parse(await readFile(join(root, "src", "data", "etfs.json"), "utf8"));
const tmpHtml = join(tmpdir(), "etf-tahak.html");
await writeFile(tmpHtml, renderTahak(data));
await mkdir(pub("tahak"), { recursive: true });
chrome([`--print-to-pdf=${pub("tahak", "etf-tahak-2026.pdf")}`, "--no-pdf-header-footer", fileUrl(tmpHtml)]);
console.log("pdf   public/tahak/etf-tahak-2026.pdf");

// ------------------------------------------------------------------ ad creatives + OG image
await mkdir(pub("ads"), { recursive: true });
const shots = [
  ["ad-fees.html", "?f=feed", 1080, 1350, pub("ads", "ad-fees-feed.png")],
  ["ad-fees.html", "?f=story", 1080, 1920, pub("ads", "ad-fees-story.png")],
  ["ad-twins.html", "?f=feed", 1080, 1350, pub("ads", "ad-twins-feed.png")],
  ["ad-twins.html", "?f=story", 1080, 1920, pub("ads", "ad-twins-story.png")],
  ["og.html", "", 1200, 630, pub("img", "og.png")],
];
for (const [file, query, w, h, out] of shots) {
  chrome([`--window-size=${w},${h}`, "--force-device-scale-factor=1", `--screenshot=${out}`, fileUrl(src("ads", file), query)]);
  console.log(`png   ${out.replace(root, "").replace(/\\/g, "/")}`);
}
