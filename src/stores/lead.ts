// Shared state between the Vue islands. Each island is a separate Vue app, so state that several of them
// need lives in nanostores (Astro's recommended way): https://docs.astro.build/en/recipes/sharing-state-islands/
import { atom } from "nanostores";

const KEY = "lead";

function read(): string | null {
  try { return typeof localStorage === "undefined" ? null : localStorage.getItem(KEY); } catch { return null; }
}

/**
 * Lead id once the visitor has signed up (persisted, so returning visitors aren't asked again).
 * When set: every form shows "Tahák už máte", the table unlocks, the sticky CTA hides.
 */
export const $leadId = atom<string | null>(read());

/** Which form submitted in this page view; that one shows the full thank-you panel. */
export const $submittedFrom = atom<string | null>(null);

export function markLead(id: string, loc: string): void {
  try { localStorage.setItem(KEY, id); } catch {}
  $submittedFrom.set(loc);
  $leadId.set(id);
}
