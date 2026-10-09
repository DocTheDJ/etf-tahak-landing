// Email validation + typo suggestion for the domains Czech visitors actually use.
// A typo in the email is a lead we paid for and can never reach.

export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i;

const DOMAINS = [
  "seznam.cz", "email.cz", "centrum.cz", "post.cz", "volny.cz", "atlas.cz", "tiscali.cz",
  "gmail.com", "outlook.com", "outlook.cz", "hotmail.com", "icloud.com", "yahoo.com",
];

export function isEmail(value: string): boolean {
  return EMAIL_RE.test(value);
}

function distance(a: string, b: string): number {
  const m = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) m[0][j] = j;
  for (let i = 1; i <= b.length; i++)
    for (let j = 1; j <= a.length; j++)
      m[i][j] = Math.min(m[i - 1][j - 1] + (b[i - 1] === a[j - 1] ? 0 : 1), m[i][j - 1] + 1, m[i - 1][j] + 1);
  return m[b.length][a.length];
}

/** "jana@sezanm.cz" -> "jana@seznam.cz"; null when the domain looks fine. */
export function suggestEmail(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  const domain = email.slice(at + 1).toLowerCase();
  if (DOMAINS.includes(domain)) return null;

  // Right provider, wrong ending ("gmail.cz", "seznam.com"): the name is the stronger signal.
  const name = domain.split(".")[0];
  const sameName = DOMAINS.find((known) => known.split(".")[0] === name);
  if (sameName) return email.slice(0, at + 1) + sameName;

  let best: string | null = null;
  let bestDistance = 3; // only suggest for 1–2 character mistakes
  for (const known of DOMAINS) {
    const d = distance(domain, known);
    if (d < bestDistance) [best, bestDistance] = [known, d];
  }
  return best ? email.slice(0, at + 1) + best : null;
}
