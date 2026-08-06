// i18next bootstrap — single source of truth for the app's language. Reads the persisted
// preference synchronously (before React mounts, see main.tsx's import order) so the very first
// render is already in the right language, avoiding an English-flash-then-switch. Namespaces are
// statically imported (no i18next-http-backend) so `t()` always resolves synchronously — no
// Suspense needed, no network round-trip to load a language.
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { DEFAULT_LOCALE, isAppLocale, type AppLocale } from "./locales";
import { setSentryLocaleTag } from "../shared/sentry";

import enCommon from "./locales/en/common.json";
import ukCommon from "./locales/uk/common.json";
import enNav from "./locales/en/nav.json";
import ukNav from "./locales/uk/nav.json";
import enDashboard from "./locales/en/dashboard.json";
import ukDashboard from "./locales/uk/dashboard.json";
import enVacancies from "./locales/en/vacancies.json";
import ukVacancies from "./locales/uk/vacancies.json";
import enCalendar from "./locales/en/calendar.json";
import ukCalendar from "./locales/uk/calendar.json";
import enRoadmap from "./locales/en/roadmap.json";
import ukRoadmap from "./locales/uk/roadmap.json";
import enAccount from "./locales/en/account.json";
import ukAccount from "./locales/uk/account.json";
import enBilling from "./locales/en/billing.json";
import ukBilling from "./locales/uk/billing.json";
import enWelcome from "./locales/en/welcome.json";
import ukWelcome from "./locales/uk/welcome.json";
import enAdmin from "./locales/en/admin.json";
import ukAdmin from "./locales/uk/admin.json";
import enAnalytics from "./locales/en/analytics.json";
import ukAnalytics from "./locales/uk/analytics.json";
import enAnalyzer from "./locales/en/analyzer.json";
import ukAnalyzer from "./locales/uk/analyzer.json";
import enAuth from "./locales/en/auth.json";
import ukAuth from "./locales/uk/auth.json";
import enChrome from "./locales/en/chrome.json";
import ukChrome from "./locales/uk/chrome.json";
import enCompanies from "./locales/en/companies.json";
import ukCompanies from "./locales/uk/companies.json";
import enContacts from "./locales/en/contacts.json";
import ukContacts from "./locales/uk/contacts.json";
import enCv from "./locales/en/cv.json";
import ukCv from "./locales/uk/cv.json";
import enDesign from "./locales/en/design.json";
import ukDesign from "./locales/uk/design.json";
import enJobs from "./locales/en/jobs.json";
import ukJobs from "./locales/uk/jobs.json";
import enLearn from "./locales/en/learn.json";
import ukLearn from "./locales/uk/learn.json";
import enMock from "./locales/en/mock.json";
import ukMock from "./locales/uk/mock.json";
import enPlan21 from "./locales/en/plan21.json";
import ukPlan21 from "./locales/uk/plan21.json";
import enProjects from "./locales/en/projects.json";
import ukProjects from "./locales/uk/projects.json";
import enResources from "./locales/en/resources.json";
import ukResources from "./locales/uk/resources.json";
import enStudy from "./locales/en/study.json";
import ukStudy from "./locales/uk/study.json";
import enGrowth from "./locales/en/growth.json";
import ukGrowth from "./locales/uk/growth.json";

// Matches the existing `jobtrack.*` localStorage key convention (see shared/notifications.ts) —
// deliberately NOT shared/ui-state.ts's `useUi`, which is an in-memory-only module singleton
// (state lives only for the current SPA session, not across a real page reload) and would be the
// wrong choice for a preference that must survive a hard refresh.
const STORAGE_KEY = "jobtrack.locale";

function initialLocale(): AppLocale {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && isAppLocale(stored)) return stored;
  // First visit, nothing stored yet — default to the browser's own language when we support it
  // rather than always English; still fully overridable via the switcher afterward. This is a
  // controllable, overridable DEFAULT — not the uncontrollable native-picker OS-locale bleed
  // shared/date-input.tsx deliberately avoids elsewhere.
  return navigator.language.toLowerCase().startsWith("uk") ? "uk" : DEFAULT_LOCALE;
}

// Exported so test/setup.ts can await it — with statically-supplied resources this settles on
// the next microtask rather than truly synchronously, and a component rendered before it settles
// would re-render once i18next finishes initializing (harmless in the real app; in tests it's a
// spurious "not wrapped in act(...)" warning if the first render races the promise).
export const i18nReady = i18n.use(initReactI18next).init({
  lng: initialLocale(),
  fallbackLng: DEFAULT_LOCALE,
  defaultNS: "common",
  resources: {
    en: {
      common: enCommon,
      nav: enNav,
      dashboard: enDashboard,
      vacancies: enVacancies,
      calendar: enCalendar,
      roadmap: enRoadmap,
      account: enAccount,
      billing: enBilling,
      welcome: enWelcome,
      admin: enAdmin,
      analytics: enAnalytics,
      analyzer: enAnalyzer,
      auth: enAuth,
      chrome: enChrome,
      companies: enCompanies,
      contacts: enContacts,
      cv: enCv,
      design: enDesign,
      jobs: enJobs,
      learn: enLearn,
      mock: enMock,
      plan21: enPlan21,
      projects: enProjects,
      resources: enResources,
      study: enStudy,
      growth: enGrowth,
    },
    uk: {
      common: ukCommon,
      nav: ukNav,
      dashboard: ukDashboard,
      vacancies: ukVacancies,
      calendar: ukCalendar,
      roadmap: ukRoadmap,
      account: ukAccount,
      billing: ukBilling,
      welcome: ukWelcome,
      admin: ukAdmin,
      analytics: ukAnalytics,
      analyzer: ukAnalyzer,
      auth: ukAuth,
      chrome: ukChrome,
      companies: ukCompanies,
      contacts: ukContacts,
      cv: ukCv,
      design: ukDesign,
      jobs: ukJobs,
      learn: ukLearn,
      mock: ukMock,
      plan21: ukPlan21,
      projects: ukProjects,
      resources: ukResources,
      study: ukStudy,
      growth: ukGrowth,
    },
  },
  interpolation: { escapeValue: false }, // React already escapes — i18next's own escaping would double-escape.
  react: { useSuspense: false },
  // Most missing/mistyped keys are already caught at compile time by i18next.d.ts's module
  // augmentation — this catches the rest (e.g. a key present in `en` but never added to `uk`).
  saveMissing: import.meta.env.DEV,
  missingKeyHandler: (langs, ns, key) => {
    if (import.meta.env.DEV) console.error(`[i18n] missing key "${key}" in namespace "${ns}" for ${langs.join(",")}`);
  },
});

document.documentElement.lang = i18n.language;
setSentryLocaleTag(i18n.language);

i18n.on("languageChanged", (lng) => {
  localStorage.setItem(STORAGE_KEY, lng);
  document.documentElement.lang = lng;
  setSentryLocaleTag(lng);
});

export default i18n;
