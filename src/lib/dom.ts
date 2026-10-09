// Small DOM helpers shared by islands.

/** Scroll to a lead form (the final one by default) and focus its email input. */
export function focusLeadForm(loc = "final"): void {
  let form = document.querySelector<HTMLElement>(`[data-loc="${loc}"]`);
  if (!form || form.offsetParent === null) form = document.querySelector<HTMLElement>('[data-loc="final"]');
  if (!form) return;
  form.scrollIntoView({ behavior: "smooth", block: "center" });
  const input = form.querySelector<HTMLInputElement>("input[type=email]");
  if (input) setTimeout(() => input.focus({ preventScroll: true }), 450);
}
