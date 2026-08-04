// Single source of truth for which languages this app supports — referenced by i18n/index.ts,
// the language switcher, and (by comment cross-reference) the server's own 2-element locale enum
// in server/src/core/request-context.ts (there's no shared client/server package, so the server
// keeps its own copy — see that file for why).
export const SUPPORTED_LOCALES = ["en", "uk"] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "en";

export function isAppLocale(value: string): value is AppLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
