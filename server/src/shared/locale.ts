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
