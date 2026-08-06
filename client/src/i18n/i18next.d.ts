// Type-safe translation keys: `t("typo.key")` becomes a `tsc` error instead of silently
// rendering the literal key string on screen. Namespaces are added here as they're created
// (client/src/i18n/locales/en/<namespace>.json) — always augment against the `en` file (the
// fallback locale), so a namespace that's only partially translated in `uk` still type-checks.
import "i18next";
import common from "./locales/en/common.json";
import nav from "./locales/en/nav.json";
import dashboard from "./locales/en/dashboard.json";
import vacancies from "./locales/en/vacancies.json";
import calendar from "./locales/en/calendar.json";
import roadmap from "./locales/en/roadmap.json";
import account from "./locales/en/account.json";
import billing from "./locales/en/billing.json";
import welcome from "./locales/en/welcome.json";
import admin from "./locales/en/admin.json";
import analytics from "./locales/en/analytics.json";
import analyzer from "./locales/en/analyzer.json";
import auth from "./locales/en/auth.json";
import chrome from "./locales/en/chrome.json";
import companies from "./locales/en/companies.json";
import contacts from "./locales/en/contacts.json";
import cv from "./locales/en/cv.json";
import design from "./locales/en/design.json";
import jobs from "./locales/en/jobs.json";
import learn from "./locales/en/learn.json";
import mock from "./locales/en/mock.json";
import plan21 from "./locales/en/plan21.json";
import projects from "./locales/en/projects.json";
import resources from "./locales/en/resources.json";
import study from "./locales/en/study.json";
import growth from "./locales/en/growth.json";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: {
      common: typeof common;
      nav: typeof nav;
      dashboard: typeof dashboard;
      vacancies: typeof vacancies;
      calendar: typeof calendar;
      roadmap: typeof roadmap;
      account: typeof account;
      billing: typeof billing;
      welcome: typeof welcome;
      admin: typeof admin;
      analytics: typeof analytics;
      analyzer: typeof analyzer;
      auth: typeof auth;
      chrome: typeof chrome;
      companies: typeof companies;
      contacts: typeof contacts;
      cv: typeof cv;
      design: typeof design;
      jobs: typeof jobs;
      learn: typeof learn;
      mock: typeof mock;
      plan21: typeof plan21;
      projects: typeof projects;
      resources: typeof resources;
      study: typeof study;
      growth: typeof growth;
    };
  }
}
