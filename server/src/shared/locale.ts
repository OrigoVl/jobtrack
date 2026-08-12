// Server-side mirror of client/src/i18n/locales.ts's SUPPORTED_LOCALES — there's no shared
// client/server package in this monorepo, so each side keeps its own 2-element copy. Used by
// core/request-context.ts (the X-Locale header lands here, see app.ts's middleware) and
// llm/client.ts's opt-in ChatOptions.outputLocale.
export const SUPPORTED_LOCALES = ["en", "uk"] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "en";

export function isAppLocale(value: string): value is AppLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** The English NAME of each locale's language, for interpolating into an LLM prompt ("Respond in
 * Ukrainian."). Lives here rather than in llm/client.ts because two call sites now need it: that
 * file's withLocaleInstruction() (the implicit, UI-locale-driven path) and cv-linkedin.service.ts
 * (an explicit, user-chosen target language that deliberately ISN'T the UI locale). */
export const LANGUAGE_NAME: Record<AppLocale, string> = { en: "English", uk: "Ukrainian" };

/** Slavic 1/2-4/5+ plural rule (11-14 are always the "many" form even though they end in a digit
 * that would otherwise read as "few") — same algorithm i18next applies to uk_one/_few/_many
 * client-side, hand-rolled here for server-generated template text (not an i18next key). Used by
 * any server template that counts something in Ukrainian (the 21-day plan, pet projects). */
export function ukPluralForm(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
