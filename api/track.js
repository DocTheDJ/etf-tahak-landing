// POST /api/track: cookieless first-party event sink (batched by public/track.js).
// Per day and segment (variant|utm_content|ask) it keeps:
//   c:{date}:{seg}          hash   event -> raw count
//   u:{date}:{seg}:{event}  HLL    unique sessions that fired the event (the funnel)
//   segs:{date}             set    segments seen that day
//   ev                      list   last 10 000 raw events (debugging)
import { redis, hasStore, today, segment, readBody, send } from "./_lib.js";

const TTL = 60 * 60 * 24 * 180; // keep 180 days
const NAME = /^[a-z0-9_]{2,32}$/;

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "method" });
  let body;
  try { body = await readBody(req); } catch { return send(res, 400, { error: "body" }); }

  const sid = String(body.sid || "").slice(0, 24);
  const events = Array.isArray(body.events) ? body.events.slice(0, 50).filter((e) => NAME.test(e?.n)) : [];
  if (!sid || !events.length) return send(res, 204, {});

  const seg = segment(body.ctx);
  const day = today();
  console.log(JSON.stringify({ kind: "events", sid, seg, events: events.map((e) => [e.n, e.t, e.p]) }));

  if (hasStore) {
    const cmds = [["SADD", `segs:${day}`, seg], ["EXPIRE", `segs:${day}`, TTL]];
    const seen = new Set();
    for (const e of events) {
      cmds.push(["HINCRBY", `c:${day}:${seg}`, e.n, 1]);
      if (!seen.has(e.n)) {
        seen.add(e.n);
        cmds.push(["PFADD", `u:${day}:${seg}:${e.n}`, sid], ["EXPIRE", `u:${day}:${seg}:${e.n}`, TTL]);
      }
      cmds.push(["LPUSH", "ev", JSON.stringify({ d: new Date().toISOString(), sid, seg, ...e })]);
    }
    cmds.push(["EXPIRE", `c:${day}:${seg}`, TTL], ["LTRIM", "ev", 0, 9999]);
    try { await redis(cmds); } catch (err) { console.error("track store failed", err.message); }
  }
  send(res, 204, {});
}
