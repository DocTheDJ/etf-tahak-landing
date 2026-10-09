// The "here's your cheat sheet" email, sent through Resend (free: 3,000 emails/month, verified domain needed).
import { RESEND_API_KEY, MAIL_FROM } from "astro:env/server";

export const canSendMail = Boolean(RESEND_API_KEY && MAIL_FROM);

export async function sendCheatSheet(to: string, pdfUrl: string, calc: { loss?: number; years?: number }): Promise<void> {
  const loss = calc.loss ? `${(Math.round(calc.loss / 1000) * 1000).toLocaleString("cs-CZ")} Kč` : null;
  const html = `<!doctype html><html lang="cs"><body style="margin:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#0e0f12">
<div style="max-width:520px;margin:0 auto;padding:28px 20px">
  <p style="font-size:13px;color:#4a463d;margin:0 0 18px"><b style="background:#d4ff3a;color:#0e0f12;padding:4px 6px;border-radius:5px;font-family:monospace">ETF</b> <b style="font-size:16px">tahák</b></p>
  <h1 style="font-size:26px;line-height:1.15;margin:0 0 14px">Tady je váš tahák.</h1>
  <p style="font-size:16px;line-height:1.5;margin:0 0 20px">12 amerických ETF z NYSE, jejich evropská dvojčata s ISINy, daně na jedné straně a 5 kroků k prvnímu nákupu.</p>
  <p style="margin:0 0 24px"><a href="${pdfUrl}" style="display:inline-block;background:#d4ff3a;color:#0e0f12;border-radius:12px;padding:16px 22px;font-weight:bold;text-decoration:none;font-size:16px">Stáhnout tahák (PDF)</a></p>
  ${loss ? `<p style="font-size:15px;line-height:1.5;margin:0 0 20px;padding:12px 14px;background:#ffffff;border-radius:10px;border:1px solid #e3e5ea">Podle kalkulačky vás poplatky za ${calc.years} let stojí navíc asi <b>${loss}</b>. Tahák ukazuje, jak to snížit.</p>` : ""}
  <p style="font-size:12px;color:#6b7180;line-height:1.4;margin:28px 0 0">Nejde o investiční doporučení. Investice nesou riziko, minulé výnosy nezaručují budoucí.<br>Tento e-mail jste dostali, protože jste si tahák vyžádali. Další vám bez souhlasu neposíláme.</p>
</div></body></html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: MAIL_FROM,
      to: [to],
      subject: "Váš ETF tahák (PDF)",
      html,
      text: `Tady je váš ETF tahák: ${pdfUrl}\n\nNejde o investiční doporučení. Tento e-mail jste dostali, protože jste si tahák vyžádali.`,
    }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
}
