// Error tracking (Sentry) — optional: no VITE_SENTRY_DSN (build-time env, Vite) → disabled,
// the app just keeps console.error'ing (as it already does in ErrorBoundary). Imported first
// in main.tsx, to catch render errors as early as possible.
import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION,
    // Tracing and session replay are disabled: it's a single SPA page, and the CV builder holds
    // arbitrary user text in the DOM — session replay on that screen is a PII incident waiting to happen.
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
  });
}

export function captureClientException(error: unknown, extra?: Record<string, unknown>): void {
  if (dsn) Sentry.captureException(error, extra ? { extra } : undefined);
}
