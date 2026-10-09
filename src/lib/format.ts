// Czech number formatting: "0,07 %", "466 000 Kč", "8. 10. 2026".

export function pct(x: number | null | undefined, digits = 2): string {
  if (x == null || Number.isNaN(x)) return "–";
  return x.toLocaleString("cs-CZ", { minimumFractionDigits: digits, maximumFractionDigits: digits }) + " %";
}

/** Rounded to thousands: big numbers read faster and don't pretend to false precision. */
export function czk(x: number): string {
  return (Math.round(x / 1000) * 1000).toLocaleString("cs-CZ", { maximumFractionDigits: 0 }) + " Kč";
}

export function czDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
}
