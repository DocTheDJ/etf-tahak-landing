// GET /api/stats?key=STATS_KEY[&days=14][&format=json]
// The funnel per segment (variant | ad creative | ask arm), counted as unique sessions per step.
import { redis, hasStore, send } from "./_lib.js";

const STEPS = [
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
  ["profile_answer", "Answered profile Q"],
];

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  if (!process.env.STATS_KEY || url.searchParams.get("key") !== process.env.STATS_KEY) return send(res, 401, { error: "key" });
  if (!hasStore) return send(res, 503, { error: "no store configured (UPSTASH_REDIS_REST_URL/TOKEN)" });

  const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days")) || 14));
  const dates = [...Array(days)].map((_, i) => new Date(Date.now() - i * 864e5).toISOString().slice(0, 10));

  const segRes = await redis(dates.map((d) => ["SMEMBERS", `segs:${d}`]));
  const segs = [...new Set(segRes.flatMap((r) => r.result || []))].sort();

  const cmds = [];
  for (const s of segs) for (const [ev] of STEPS) cmds.push(["PFCOUNT", ...dates.map((d) => `u:${d}:${s}:${ev}`)]);
  for (const [ev] of STEPS) cmds.push(["PFCOUNT", ...segs.flatMap((s) => dates.map((d) => `u:${d}:${s}:${ev}`))]);
  const counts = cmds.length ? (await redis(cmds)).map((r) => r.result || 0) : [];

  const rows = segs.map((s, i) => ({ segment: s, steps: Object.fromEntries(STEPS.map(([ev], j) => [ev, counts[i * STEPS.length + j]])) }));
  const total = { segment: "ALL", steps: Object.fromEntries(STEPS.map(([ev], j) => [ev, segs.length ? counts[segs.length * STEPS.length + j] : 0])) };
  rows.push(total);

  if (url.searchParams.get("format") === "json") return send(res, 200, { days, rows });

  const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1) + "%" : "–");
  const th = STEPS.map(([, label]) => `<th>${label}</th>`).join("");
  const tr = rows.map((r) => `<tr${r.segment === "ALL" ? ' class="all"' : ""}><td>${r.segment.replace(/\|/g, " · ")}</td>${STEPS.map(([ev]) =>
    `<td><b>${r.steps[ev]}</b><small>${ev === "lp_view" ? "" : pct(r.steps[ev], r.steps.lp_view)}</small></td>`).join("")}<td class="cr">${pct(r.steps.lead_ok, r.steps.lp_view)}</td></tr>`).join("");

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>ETF tahák funnel</title>
<style>body{font:14px/1.4 system-ui,sans-serif;margin:20px;background:#f3efe6;color:#16140f}table{border-collapse:collapse;background:#fff}th,td{border:1px solid #16140f;padding:6px 8px;text-align:right;white-space:nowrap}th{background:#16140f;color:#ffe45c;font-size:12px}td:first-child{text-align:left;font-family:monospace}small{display:block;color:#7b766a}tr.all{background:#fffbe0}.cr{font-weight:bold;color:#0c7448}.wrap{overflow-x:auto}</style>
<h1>Funnel, last ${days} days</h1><p>Unique sessions per step. Segment = variant · utm_content · ask arm. % = share of landed sessions.</p>
<div class="wrap"><table><tr><th>Segment</th>${th}<th>Visit → lead</th></tr>${tr}</table></div>`);
}
