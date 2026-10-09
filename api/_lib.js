// Shared helpers for the serverless functions. Files starting with "_" are not routes on Vercel.
//
// Storage: Upstash Redis over REST (free tier). Vercel's marketplace integration sets either
// KV_REST_API_URL/KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN; both work.
// Without it, everything is still logged to the function logs, so nothing crashes. It's just not persisted.

const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

export const hasStore = Boolean(URL_ && TOKEN);

export async function redis(commands) {
  if (!hasStore) return null;
  const res = await fetch(`${URL_}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`redis ${res.status}: ${await res.text()}`);
  return res.json();
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

// Funnel buckets: variant | ad creative (utm_content) | ask experiment arm
export function segment(ctx = {}) {
  const clean = (s, n = 40) => String(s || "-").replace(/[^\w.-]/g, "_").slice(0, n) || "-";
  return `${clean(ctx.v, 10)}|${clean(ctx.utm_content)}|${clean(ctx.ask, 6)}`;
}

export async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 32_000) throw new Error("body too large");
    chunks.push(c);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Cache-Control", "no-store");
  if (status === 204) return res.end();
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}
