/** Formats an estimated USD cost (admin panel, `llm/pricing.ts` on the server) — 4 decimal
 * places for anything under a cent (otherwise a per-feature/per-day cost of $0.0003 would
 * round to a misleading "$0.00"), 2 decimal places otherwise. */
export function money(v: number): string {
  return v < 0.01 && v > 0 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`;
}
