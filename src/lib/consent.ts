// Marketing consent for the follow-up tips emails (Czech Act 480/2004 Sb. §7 + GDPR art. 6(1)(a), art. 7).
//
// The PDF itself is delivered because the visitor asked for it (no consent needed). The 4 tips emails are
// commercial communication, so they're sent only after a separate, explicit opt-in on the thank-you panel:
// never pre-ticked, never a condition for the PDF.
//
// The exact wording is versioned. The browser sends the version it showed; the server stores that version
// AND its text with a timestamp, so every consent can be proven later. Changing the wording = new version
// (keep the old ones here so stored consents still resolve).

export interface ConsentText {
  version: string;
  text: string;
}

export const CONSENT_TEXTS: ConsentText[] = [
  {
    version: "tips-2026-10-09",
    text:
      "Souhlasím se zasíláním 4 krátkých e-mailů s tipy k investování do ETF (výběr brokera, trvalý příkaz, daně, DIP) " +
      "od provozovatele ETF taháku. Souhlas mohu kdykoli odvolat odkazem v každém e-mailu.",
  },
];

/** The wording shown right now. */
export const CURRENT_CONSENT = CONSENT_TEXTS[CONSENT_TEXTS.length - 1];

export function consentText(version: string): string | null {
  return CONSENT_TEXTS.find((c) => c.version === version)?.text ?? null;
}
