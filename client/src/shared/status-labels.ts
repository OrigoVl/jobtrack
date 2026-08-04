import i18n from "../i18n";
import type { VacancyStatus } from "./types";

// Maps each persisted VacancyStatus wire value (English, stable — stored in Postgres and
// returned by the API, see shared/types.ts's STATUSES) to the i18next key used to look up its
// translated DISPLAY label under vacancyStatus.<key> (common namespace). The wire value itself never changes
// with the UI language, only the label shown to the user does — status-tone.ts's color lookups
// stay keyed by the English wire value too, untouched by this mapping.
const STATUS_KEY: Record<VacancyStatus, string> = {
  "Want to apply": "wantToApply",
  Applied: "applied",
  Screening: "screening",
  "Tech interview": "techInterview",
  "Take-home task": "takeHomeTask",
  Final: "final",
  Offer: "offer",
  Rejected: "rejected",
  Paused: "paused",
};

/** `status` is typed as `string` server-side historically (arbitrary values were accepted before
 * STATUSES existed) — falling back to the raw value for anything unrecognized matches
 * status-tone.ts's own DEFAULT_STATUS_* fallback convention: never throw, never show a blank. */
export function statusKey(status: string): string {
  return STATUS_KEY[status as VacancyStatus] ?? status;
}

/**
 * Translates a vacancy status for display — every page that shows a status (Dashboard, Vacancies
 * table/Kanban, Analytics, Calendar's "Vacancy step" legend, ...) should call this instead of
 * reaching for `t()` directly. Centralizing it here means the one unavoidable type-safety escape
 * hatch (below) lives in exactly one reviewed place: `t()`'s literal-key typing (see
 * i18n/i18next.d.ts) can't verify a key built from a runtime string like `statusKey(status)` —
 * the actual safety net for this one spot is status-labels.test.ts, which asserts every STATUSES
 * member maps to a real key present in both locale files, not tsc.
 *
 * Calls the i18next singleton directly (not a `t` passed in from the caller's own
 * `useTranslation()`) — react-i18next's `TFunction` is generic over the CALLING component's
 * default namespace (e.g. `TFunction<"dashboard">`), so no single parameter type would accept the
 * `t` from every page that calls this. The calling component still re-renders correctly on a
 * language change because it already subscribes via its own `useTranslation()` call — this just
 * reads the (now-updated) active language at that same render.
 */
export function statusLabel(status: string): string {
  // This key is necessarily built at runtime, which i18next's literal-key typing can't verify —
  // see the doc comment above for why this is the one deliberate escape hatch.
  // defaultValue: an unrecognized status (see statusKey's own fallback) would otherwise render
  // i18next's own missing-key fallback — the literal key string "vacancyStatus.Some Future
  // Status" — instead of the raw status text a user would actually recognize.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return i18n.t(`common:vacancyStatus.${statusKey(status)}` as any, { defaultValue: status });
}
