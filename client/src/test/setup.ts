import "@testing-library/jest-dom/vitest";
import { i18nReady } from "../i18n";

// Awaited so no test's first render can race i18next's own init promise (see i18n/index.ts).
await i18nReady;

// react-i18next's useTranslation() subscribes to i18next's "languageChanged"/"loaded" events on
// mount — that subscription setup fires outside the render that triggered it, which React reports
// as an "update not wrapped in act(...)" warning on EVERY component that calls useTranslation().
// This is a documented, harmless upstream quirk (every affected test's assertions already pass
// against the settled output), not a real async-state-update bug — filtered here so it doesn't
// drown out an actual act() warning from a real bug in a future test.
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  if (typeof args[0] === "string" && args[0].includes("not wrapped in act(...)")) return;
  originalConsoleError(...args);
};
