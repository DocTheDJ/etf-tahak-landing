// POST  /api/lead: validate, store, forward and email a new lead.
// PATCH /api/lead: attach the optional post-submit answer (progressive profiling).
import type { APIRoute } from "astro";
import { LEAD_WEBHOOK_URL, SITE_URL } from "astro:env/server";
import { isEmail } from "@/lib/email";
import { json, readJson } from "@/lib/server/http";
import { redis, hasStore, today, segment } from "@/lib/server/redis";
import { canSendMail, sendCheatSheet } from "@/lib/server/mail";
import { config } from "@/config";

export const prerender = false;

interface LeadBody {
  email?: string;
  company?: string; // honeypot
  loc?: string;
  sid?: string;
  t?: number;
  ctx?: Record<string, string>;
  calc?: { monthly?: number; years?: number; fee?: number; loss?: number; touched?: boolean };
}

export const POST: APIRoute = async ({ request, url }) => {
  let body: LeadBody;
  try { body = await readJson<LeadBody>(request); } catch { return json(400, { error: "body" }); }

  if (body.company) return json(200, { ok: true, id: "x", emailed: false }); // bot: pretend success
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!isEmail(email)) return json(422, { error: "invalid_email" });

  const ctx = body.ctx ?? {};
  const calc = body.calc?.touched ? body.calc : {}; // only keep calculator values the visitor actually set
  const lead = {
    id: crypto.randomUUID().replace(/-/g, "").slice(0, 16),
    email,
    created: new Date().toISOString(),
    loc: String(body.loc ?? "").slice(0, 20),
    variant: ctx.v ?? "",
    ask: ctx.ask ?? "",
    utm_source: ctx.utm_source ?? "",
    utm_medium: ctx.utm_medium ?? "",
    utm_campaign: ctx.utm_campaign ?? "",
    utm_content: ctx.utm_content ?? "",
    referrer: ctx.ref ?? "",
    time_to_lead_s: Math.round(Number(body.t) || 0),
    calc_monthly: Number(calc.monthly) || "",
    calc_years: Number(calc.years) || "",
    calc_fee: Number(calc.fee) || "",
    calc_loss: Number(calc.loss) || "",
    sid: String(body.sid ?? "").slice(0, 24),
  };
  console.log(JSON.stringify({ kind: "lead", ...lead, email: mask(email) }));

  let duplicate = false;
  if (hasStore) {
    const seg = segment(ctx);
    const day = today();
    try {
      const out = await redis([
        ["SADD", "emails", email],
        ["HSET", `lead:${lead.id}`, ...Object.entries(lead).flat().map(String)],
        ["LPUSH", "leads", lead.id],
        ["HINCRBY", `c:${day}:${seg}`, "lead_ok", 1],
        ["PFADD", `u:${day}:${seg}:lead_ok`, lead.sid || lead.id],
        ["SADD", `segs:${day}`, seg],
      ]);
      duplicate = out?.[0]?.result === 0;
      if (duplicate) await redis([["HSET", `lead:${lead.id}`, "duplicate", "1"]]);
    } catch (err) {
      console.error("lead store failed", (err as Error).message);
    }
  }

  const base = SITE_URL || url.origin;
  let emailed = false;
  await Promise.all([
    LEAD_WEBHOOK_URL &&
      fetch(LEAD_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...lead, duplicate }) })
        .catch((err) => console.error("webhook failed", err.message)),
    canSendMail &&
      sendCheatSheet(email, base + config.pdfUrl, { loss: Number(calc.loss), years: Number(calc.years) })
        .then(() => { emailed = true; })
        .catch((err) => console.error("mail failed", err.message)),
  ]);

  return json(200, { ok: true, id: lead.id, emailed });
};

export const PATCH: APIRoute = async ({ request }) => {
  let body: { id?: string; profile?: { monthly?: string } };
  try { body = await readJson(request); } catch { return json(400, { error: "body" }); }
  const id = String(body.id ?? "").slice(0, 20);
  const monthly = String(body.profile?.monthly ?? "").slice(0, 10);
  if (!id || !monthly) return json(400, { error: "bad" });

  console.log(JSON.stringify({ kind: "profile", id, monthly }));
  if (hasStore) {
    try {
      const out = await redis([["EXISTS", `lead:${id}`]]);
      if (out?.[0]?.result === 1) await redis([["HSET", `lead:${id}`, "profile_monthly", monthly]]);
    } catch (err) { console.error("profile store failed", (err as Error).message); }
  }
  if (LEAD_WEBHOOK_URL) {
    await fetch(LEAD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "profile", id, profile_monthly: monthly }),
    }).catch(() => {});
  }
  return json(200, { ok: true });
};

function mask(email: string): string {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 2)}***@${domain}`;
}
