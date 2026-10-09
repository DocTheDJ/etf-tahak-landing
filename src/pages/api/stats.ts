// GET /api/stats?key=STATS_KEY[&days=14][&format=json]
// The funnel per segment (variant | ad creative | ask arm), counted as unique sessions per step.
import type { APIRoute } from "astro";
import { STATS_KEY } from "astro:env/server";
import { json } from "@/lib/server/http";
import { redis, hasStore } from "@/lib/server/redis";

export const prerender = false;

const STEPS: [event: string, label: string][] = [
  ["lp_view", "Landed"],
  ["engaged_10s", "Stayed 10 s"],
  ["calc_interact", "Used calculator"],
  ["table_filter", "Filtered table"],
  ["locked_click", "Clicked locked twin"],
  ["form_view", "Saw a form"],
  ["form_start", "Focused email"],
  ["form_submit", "Submitted"],
  ["lead_ok", "Lead stored (server)"],
  ["pdf_download", "Downloaded PDF"],
  ["optin_given", "Opted in to tips emails"],
  ["profile_answer", "Answered profile Q"],
];

export const GET: APIRoute = async ({ url }) => {
  if (!STATS_KEY || url.searchParams.get("key") !== STATS_KEY) return json(401, { error: "key" });
  if (!hasStore) return json(503, { error: "no store configured (UPSTASH_REDIS_REST_URL/TOKEN)" });

  const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days")) || 14));
  const dates = Array.from({ length: days }, (_, i) => new Date(Date.now() - i * 864e5).toISOString().slice(0, 10));

  const segRes = (await redis(dates.map((d) => ["SMEMBERS", `segs:${d}`]))) ?? [];
  const segs = [...new Set(segRes.flatMap((r) => (r.result as string[]) ?? []))].sort();

  // one PFCOUNT per (segment, step) over all days, then one per step over everything (the ALL row)
  const keys = (s: string, ev: string) => dates.map((d) => `u:${d}:${s}:${ev}`);
  const cmds = [
    ...segs.flatMap((s) => STEPS.map(([ev]) => ["PFCOUNT", ...keys(s, ev)])),
    ...(segs.length ? STEPS.map(([ev]) => ["PFCOUNT", ...segs.flatMap((s) => keys(s, ev))]) : []),
  ];
  const counts = cmds.length ? ((await redis(cmds)) ?? []).map((r) => Number(r.result) || 0) : [];

  const row = (segment: string, offset: number) => ({
    segment,
    steps: Object.fromEntries(STEPS.map(([ev], j) => [ev, counts[offset + j] ?? 0])) as Record<string, number>,
  });
  const rows = [...segs.map((s, i) => row(s, i * STEPS.length)), row("ALL", segs.length * STEPS.length)];

  if (url.searchParams.get("format") === "json") return json(200, { days, rows });

  const pct = (a: number, b: number) => (b ? ((a / b) * 100).toFixed(1) + "%" : "–");
  const head = STEPS.map(([, label]) => `<th>${label}</th>`).join("");
  const body = rows
    .map((r) => `<tr${r.segment === "ALL" ? ' class="all"' : ""}><td>${r.segment.replace(/\|/g, " · ")}</td>${STEPS.map(
      ([ev]) => `<td><b>${r.steps[ev]}</b><small>${ev === "lp_view" ? "" : pct(r.steps[ev], r.steps.lp_view)}</small></td>`,
    ).join("")}<td class="cr">${pct(r.steps.lead_ok, r.steps.lp_view)}</td></tr>`)
    .join("");

  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>ETF tahák funnel</title>
<style>body{font:14px/1.4 system-ui,sans-serif;margin:20px;background:#f3efe6;color:#16140f}table{border-collapse:collapse;background:#fff}th,td{border:1px solid #16140f;padding:6px 8px;text-align:right;white-space:nowrap}th{background:#16140f;color:#ffe45c;font-size:12px}td:first-child{text-align:left;font-family:monospace}small{display:block;color:#7b766a}tr.all{background:#fffbe0}.cr{font-weight:bold;color:#0c7448}.wrap{overflow-x:auto}</style>
<h1>Funnel, last ${days} days</h1><p>Unique sessions per step. Segment = variant · utm_content · ask arm. % = share of landed sessions.</p>
<div class="wrap"><table><tr><th>Segment</th>${head}<th>Visit → lead</th></tr>${body}</table></div>`,
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
};
