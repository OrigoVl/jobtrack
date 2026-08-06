import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Segmented } from "./ui";
import { SUPPORTED_LOCALES, type AppLocale } from "../i18n/locales";

const LOCALE_LABEL: Record<AppLocale, string> = { en: "EN", uk: "UK" };

/** Switches the app's language (see i18n/index.ts) — i18next persists the choice and every
 * mounted useTranslation() consumer re-renders automatically, no page reload needed, for STATIC
 * strings. Server-fetched data is a different story: `api.ts` sends the active locale as an
 * `X-Locale` header on every request, so any already-cached query response (LLM-generated prose
 * — Focus of the Week, roadmap/knowledge-base text, etc.) was fetched under the OLD locale and
 * would otherwise keep rendering in that language until its `staleTime` naturally expires.
 * `invalidateQueries()` with no filter marks every cached query stale so React Query refetches
 * every currently-mounted one against the new locale — a rare, deliberate action, so a blanket
 * refetch is the simplest correct fix (matching every response's language to the new locale) at
 * a cost of some extra background requests. */
export function LanguageSwitcher({ size = "sm" }: { size?: "sm" | "md" }) {
  const { i18n } = useTranslation();
  const qc = useQueryClient();
  return (
    <Segmented
      size={size}
      value={i18n.language as AppLocale}
      onChange={(locale) => {
        void i18n.changeLanguage(locale);
        void qc.invalidateQueries();
      }}
      options={SUPPORTED_LOCALES.map((locale) => ({ value: locale, label: LOCALE_LABEL[locale] }))}
    />
  );
}
