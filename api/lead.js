// POST  /api/lead: store the lead, forward it, email the cheat sheet.
// PATCH /api/lead: attach the optional post-submit answer (progressive profiling).
//
// Env (all optional; the page works without any of them, see README > Launch checklist):
//   UPSTASH_REDIS_REST_URL / _TOKEN  persist leads + funnel
//   LEAD_WEBHOOK_URL                 POST every lead as JSON (Make, Zapier, Ecomail, Google Apps Script…)
//   RESEND_API_KEY + MAIL_FROM       send the PDF link by email (e.g. MAIL_FROM="ETF tahák <tahak@vasedomena.cz>")
//   SITE_URL                         absolute base for links in the email (defaults to the request host)
import { randomBytes } from "node:crypto";
import { redis, hasStore, today, segment, readBody, send } from "./_lib.js";

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i;
const PDF_PATH = "/tahak/etf-tahak-2026.pdf";

export default async function handler(req, res) {
  let body;
  try { body = await readBody(req); } catch { return send(res, 400, { error: "body" }); }

  if (req.method === "PATCH") return profile(res, body);
  if (req.method !== "POST") return send(res, 405, { error: "method" });

  if (body.company) return send(res, 200, { ok: true, id: "x", emailed: false }); // honeypot: pretend success
  const email = String(body.email || "").trim().toLowerCase();
  if (!EMAIL.test(email)) return send(res, 422, { error: "invalid_email" });

  const id = randomBytes(9).toString("base64url");
  const ctx = body.ctx && typeof body.ctx === "object" ? body.ctx : {};
  const calc = body.calc && typeof body.calc === "object" ? body.calc : {};
  const lead = {
    id,
    email,
    created: new Date().toISOString(),
    loc: String(body.loc || "").slice(0, 20),
    variant: String(ctx.v || ""),
    ask: String(ctx.ask || ""),
    utm_source: String(ctx.utm_source || ""),
    utm_medium: String(ctx.utm_medium || ""),
    utm_campaign: String(ctx.utm_campaign || ""),
    utm_content: String(ctx.utm_content || ""),
    referrer: String(ctx.ref || ""),
    time_to_lead_s: Math.round(Number(body.t) || 0),
    calc_monthly: Number(calc.monthly) || "",
    calc_years: Number(calc.years) || "",
    calc_fee: Number(calc.fee) || "",
    calc_loss: Number(calc.loss) || "",
    sid: String(body.sid || "").slice(0, 24),
  };
  console.log(JSON.stringify({ kind: "lead", ...lead, email: mask(email) }));

  let duplicate = false;
  if (hasStore) {
    const seg = segment(ctx);
    const day = today();
    try {
      const out = await redis([
        ["SADD", "emails", email],
        ["HSET", `lead:${id}`, ...Object.entries(lead).flat().map(String)],
        ["LPUSH", "leads", id],
        ["HINCRBY", `c:${day}:${seg}`, "lead_ok", 1],
        ["PFADD", `u:${day}:${seg}:lead_ok`, lead.sid || id],
        ["SADD", `segs:${day}`, seg],
      ]);
      duplicate = out?.[0]?.result === 0;
      if (duplicate) await redis([["HSET", `lead:${id}`, "duplicate", "1"]]);
    } catch (err) {
      console.error("lead store failed", err.message);
    }
  }

  const base = process.env.SITE_URL || `https://${req.headers["x-forwarded-host"] || req.headers.host}`;
  const tasks = [];
  if (process.env.LEAD_WEBHOOK_URL) {
    tasks.push(
      fetch(process.env.LEAD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...lead, duplicate }),
      }).catch((err) => console.error("webhook failed", err.message))
    );
  }
  let emailed = false;
  if (process.env.RESEND_API_KEY && process.env.MAIL_FROM) {
    tasks.push(
      sendMail(email, `${base}${PDF_PATH}`, lead)
        .then(() => { emailed = true; })
        .catch((err) => console.error("mail failed", err.message))
    );
  }
  await Promise.all(tasks);

  send(res, 200, { ok: true, id, emailed });
}

async function profile(res, body) {
  const id = String(body.id || "").slice(0, 20);
  const monthly = String(body.profile?.monthly || "").slice(0, 10);
  if (!id || !monthly) return send(res, 400, { error: "bad" });
  console.log(JSON.stringify({ kind: "profile", id, monthly }));
  if (hasStore) {
    try {
      const out = await redis([["EXISTS", `lead:${id}`]]);
      if (out?.[0]?.result === 1) await redis([["HSET", `lead:${id}`, "profile_monthly", monthly]]);
    } catch (err) { console.error("profile store failed", err.message); }
  }
  if (process.env.LEAD_WEBHOOK_URL) {
    await fetch(process.env.LEAD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, profile_monthly: monthly, kind: "profile" }),
    }).catch(() => {});
  }
  send(res, 200, { ok: true });
}

function mask(email) {
  const [u, d] = email.split("@");
  return `${u.slice(0, 2)}***@${d}`;
}

async function sendMail(to, pdfUrl, lead) {
  const loss = lead.calc_loss ? `${Math.round(lead.calc_loss / 1000).toLocaleString("cs-CZ")} 000 Kč` : null;
  const html = `<!doctype html><html lang="cs"><body style="margin:0;background:#f3efe6;font-family:Arial,Helvetica,sans-serif;color:#16140f">
<div style="max-width:520px;margin:0 auto;padding:28px 20px">
  <p style="font-size:13px;color:#4a463d;margin:0 0 18px"><b style="background:#16140f;color:#ffe45c;padding:3px 5px;font-family:monospace">ETF</b> <b>tahák</b></p>
  <h1 style="font-size:26px;line-height:1.15;margin:0 0 14px">Tady je váš tahák.</h1>
  <p style="font-size:16px;line-height:1.5;margin:0 0 20px">12 amerických ETF z NYSE, jejich evropská dvojčata s ISINy, daně na jedné straně a 5 kroků k prvnímu nákupu.</p>
  <p style="margin:0 0 24px"><a href="${pdfUrl}" style="display:inline-block;background:#ffe45c;color:#16140f;border:2px solid #16140f;padding:14px 20px;font-weight:bold;text-decoration:none;font-size:16px">Stáhnout tahák (PDF)</a></p>
  ${loss ? `<p style="font-size:15px;line-height:1.5;margin:0 0 20px;padding:12px 14px;background:#fffbe0;border-left:4px solid #c8281f">Podle kalkulačky vás poplatky za ${lead.calc_years} let stojí navíc asi <b>${loss}</b>. Tahák ukazuje, jak to snížit.</p>` : ""}
  <p style="font-size:15px;line-height:1.5;margin:0 0 8px">Během pár dní vám pošleme ještě 4 krátké e-maily: jak vybrat brokera, jak nastavit pravidelnou investici, daně a DIP. Nic víc.</p>
  <p style="font-size:12px;color:#7b766a;line-height:1.4;margin:28px 0 0">Nejde o investiční doporučení. Investice nesou riziko, minulé výnosy nezaručují budoucí.<br>Nechcete další e-maily? Odpovězte „stop“ a vyřadíme vás.</p>
</div></body></html>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.MAIL_FROM,
      to: [to],
      subject: "Váš ETF tahák (PDF)",
      html,
      text: `Tady je váš ETF tahák: ${pdfUrl}\n\nNejde o investiční doporučení. Nechcete další e-maily? Odpovězte „stop“.`,
    }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
}
