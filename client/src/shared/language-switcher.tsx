import { useTranslation } from "react-i18next";
import { Segmented } from "./ui";
import { SUPPORTED_LOCALES, type AppLocale } from "../i18n/locales";

const LOCALE_LABEL: Record<AppLocale, string> = { en: "EN", uk: "UK" };

/** Switches the app's language (see i18n/index.ts) — i18next persists the choice and every
 * mounted useTranslation() consumer re-renders automatically, no page reload needed. */
export function LanguageSwitcher({ size = "sm" }: { size?: "sm" | "md" }) {
  const { i18n } = useTranslation();
  return (
    <Segmented
      size={size}
      value={i18n.language as AppLocale}
      onChange={(locale) => void i18n.changeLanguage(locale)}
      options={SUPPORTED_LOCALES.map((locale) => ({ value: locale, label: LOCALE_LABEL[locale] }))}
    />
  );
}
