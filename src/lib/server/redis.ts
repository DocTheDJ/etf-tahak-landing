// Upstash Redis over REST (free tier, no driver needed). Vercel's marketplace integration sets either
// UPSTASH_REDIS_REST_* or KV_REST_API_*; both work. Without it, the API routes still work and log to
// the function logs; nothing is persisted.
import { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, KV_REST_API_URL, KV_REST_API_TOKEN } from "astro:env/server";

const url = UPSTASH_REDIS_REST_URL || KV_REST_API_URL;
const token = UPSTASH_REDIS_REST_TOKEN || KV_REST_API_TOKEN;

export const hasStore = Boolean(url && token);

type Command = (string | number)[];

/** Run several commands in one round trip. Returns null when no store is configured. */
export async function redis(commands: Command[]): Promise<{ result: unknown }[] | null> {
  if (!hasStore) return null;
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`redis ${res.status}: ${await res.text()}`);
  return res.json();
}

/** Keep funnel data for 180 days. */
export const TTL = 60 * 60 * 24 * 180;

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Funnel bucket: page variant | ad creative (utm_content) | ask experiment arm. */
export function segment(ctx: Record<string, unknown> = {}): string {
  const clean = (s: unknown, n = 40) => String(s || "-").replace(/[^\w.-]/g, "_").slice(0, n) || "-";
  return `${clean(ctx.v, 10)}|${clean(ctx.utm_content)}|${clean(ctx.ask, 6)}`;
}
