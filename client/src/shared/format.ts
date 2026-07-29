/** English pluralization for UI copy — "1 vacancy" vs "2 vacancies", instead of always "vacancies". */
const rules = new Intl.PluralRules("en-US");

/** Returns `${n} ${singular or plural}`, choosing the form via `Intl.PluralRules` (so it also
 * handles English's "zero/one/other" correctly: 0 and 2+ both take the plural form). Pass an
 * explicit `pluralForm` for irregular plurals (e.g. `plural(n, "entry", "entries")`); otherwise
 * it defaults to `${singular}s`. */
export function plural(n: number, singular: string, pluralForm: string = `${singular}s`): string {
  const word = rules.select(n) === "one" ? singular : pluralForm;
  return `${n} ${word}`;
}

/** Formats an estimated USD cost (admin panel, `llm/pricing.ts` on the server) — 4 decimal
 * places for anything under a cent (otherwise a per-feature/per-day cost of $0.0003 would
 * round to a misleading "$0.00"), 2 decimal places otherwise. */
export function money(v: number): string {
  return v < 0.01 && v > 0 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`;
}
