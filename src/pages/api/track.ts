// POST /api/track: cookieless first-party event sink (batched by src/lib/tracking.ts).
// Per day and segment (variant|utm_content|ask) it keeps:
//   c:{date}:{seg}          hash   event -> raw count
//   u:{date}:{seg}:{event}  HLL    unique sessions that fired the event (= the funnel)
//   segs:{date}             set    segments seen that day
//   ev                      list   last 10 000 raw events (debugging)
import type { APIRoute } from "astro";
import { json, readJson } from "@/lib/server/http";
import { redis, hasStore, today, segment, TTL } from "@/lib/server/redis";

export const prerender = false;

const NAME = /^[a-z0-9_]{2,32}$/;

interface TrackBody {
  sid?: string;
  ctx?: Record<string, unknown>;
  events?: { n: string; p?: Record<string, unknown>; t?: number }[];
}

export const POST: APIRoute = async ({ request }) => {
  let body: TrackBody;
  try { body = await readJson<TrackBody>(request); } catch { return json(400, { error: "body" }); }

  const sid = String(body.sid ?? "").slice(0, 24);
  const events = (body.events ?? []).slice(0, 50).filter((e) => NAME.test(e?.n));
  if (!sid || !events.length) return json(204, null);

  const seg = segment(body.ctx);
  const day = today();
  console.log(JSON.stringify({ kind: "events", sid, seg, events: events.map((e) => [e.n, e.t, e.p]) }));

  if (hasStore) {
    const cmds: (string | number)[][] = [["SADD", `segs:${day}`, seg], ["EXPIRE", `segs:${day}`, TTL]];
    for (const name of new Set(events.map((e) => e.n))) {
      cmds.push(["PFADD", `u:${day}:${seg}:${name}`, sid], ["EXPIRE", `u:${day}:${seg}:${name}`, TTL]);
    }
    for (const e of events) {
      cmds.push(["HINCRBY", `c:${day}:${seg}`, e.n, 1]);
      cmds.push(["LPUSH", "ev", JSON.stringify({ d: new Date().toISOString(), sid, seg, ...e })]);
    }
    cmds.push(["EXPIRE", `c:${day}:${seg}`, TTL], ["LTRIM", "ev", 0, 9999]);
    try { await redis(cmds); } catch (err) { console.error("track store failed", (err as Error).message); }
  }
  return json(204, null);
};
