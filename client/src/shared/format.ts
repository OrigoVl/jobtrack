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
