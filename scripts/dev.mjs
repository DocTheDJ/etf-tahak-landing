// Zero-dependency local server: serves public/ and runs api/*.js like Vercel does.
//   node scripts/dev.mjs   ->  http://localhost:3000
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".pdf": "application/pdf", ".ico": "image/x-icon",
};

http.createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  try {
    if (path.startsWith("/api/")) {
      const name = path.slice(5).replace(/[^\w-]/g, "");
      const mod = await import(pathToFileURL(join(root, "api", `${name}.js`)).href + `?t=${Date.now()}`);
      return await mod.default(req, res);
    }
    let file = normalize(join(root, "public", path));
    if (!file.startsWith(join(root, "public"))) throw new Error("bad path");
    const s = await stat(file).catch(() => null);
    if (s?.isDirectory()) file = join(file, "index.html");
    else if (!s && !extname(file)) file += ".html"; // cleanUrls
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch (err) {
    if (err.code !== "ENOENT") console.error(err);
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404");
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
