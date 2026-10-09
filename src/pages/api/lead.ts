// POST  /api/lead: validate, store, forward and email a new lead.
// PATCH /api/lead: attach what the visitor adds on the thank-you panel: the profiling answer and/or the
//                  marketing consent for the tips emails (versioned wording + timestamp, see lib/consent.ts).
import type { APIRoute } from "astro";
import { LEAD_WEBHOOK_URL, SITE_URL } from "astro:env/server";
import { isEmail } from "@/lib/email";
import { consentText } from "@/lib/consent";
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
    // the PDF is sent because they asked for it; tips emails need the separate opt-in (PATCH below)
    marketing_consent: "0",
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

interface PatchBody {
  id?: string;
  email?: string;
  profile?: { monthly?: string };
  consent?: { granted?: boolean; version?: string };
}

export const PATCH: APIRoute = async ({ request }) => {
  let body: PatchBody;
  try { body = await readJson<PatchBody>(request); } catch { return json(400, { error: "body" }); }
  const id = String(body.id ?? "").slice(0, 20);
  const monthly = String(body.profile?.monthly ?? "").slice(0, 10);
  const wantsConsent = body.consent?.granted === true;
  if (!id || (!monthly && !wantsConsent)) return json(400, { error: "bad" });

  // Consent is only valid for wording we know we showed. Store the text itself, not just a flag.
  let consent: Record<string, string> | null = null;
  if (wantsConsent) {
    const version = String(body.consent?.version ?? "");
    const text = consentText(version);
    if (!text) return json(400, { error: "unknown_consent_version" });
    consent = {
      marketing_consent: "1",
      consent_at: new Date().toISOString(),
      consent_version: version,
      consent_text: text,
      consent_source: "thank_you_panel",
    };
  }

  // Whose email: with a store, the lead id (a random secret only that visitor's browser knows) must exist and the
  // stored email wins over anything sent by the client. Without a store we can only pass on what the client sent.
  let email = isEmail(String(body.email ?? "").trim()) ? String(body.email).trim().toLowerCase() : "";
  if (hasStore) {
    try {
      const out = await redis([["HGET", `lead:${id}`, "email"]]);
      const stored = out?.[0]?.result as string | null;
      if (!stored) return json(404, { error: "unknown_lead" });
      email = stored;
      const fields = { ...(monthly ? { profile_monthly: monthly } : {}), ...(consent ?? {}) };
      await redis([["HSET", `lead:${id}`, ...Object.entries(fields).flat()]]);
    } catch (err) {
      console.error("patch store failed", (err as Error).message);
      if (consent) return json(503, { error: "store" }); // never confirm a consent we couldn't record
    }
  }

  console.log(JSON.stringify({ kind: consent ? "consent" : "profile", id, monthly, consent_version: consent?.consent_version, email: email && mask(email) }));
  if (LEAD_WEBHOOK_URL) {
    await fetch(LEAD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: consent ? "consent" : "profile", id, email, ...(monthly ? { profile_monthly: monthly } : {}), ...(consent ?? {}) }),
    }).catch((err) => console.error("webhook failed", err.message));
  }
  return json(200, { ok: true });
};

function mask(email: string): string {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 2)}***@${domain}`;
}
