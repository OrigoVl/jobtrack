// Presentation constants shared by the Calendar page and its sub-components (day popover,
// upcoming card, event modal). Extracted from calendar.tsx when that file grew a grid, a
// popover and an agenda — these are plain data, so they live in a .ts module that any of those
// files can import without a circular component dependency.
import type { CalendarEventType, Company, Contact, Vacancy } from "../../shared/types";

// "reminder" uses a non-brand amber (not --alert, which is now equal to --signal — see index.css's
// glossary, one accent not two) so it stays visually distinct from "interview"'s indigo in this
// same legend row. "deadline" used to be rose-500, which was nearly the same hue/value as the
// app's old coral --star/--signal — indistinguishable from "interview" at legend-dot size — so
// it's teal here instead; still a comfortable hue gap against the other four now that
// "interview" is indigo rather than coral (indigo/sky/teal/amber/gray).
export const TYPE_DOT: Record<CalendarEventType, string> = {
  interview: "bg-star",
  call: "bg-sky-500",
  deadline: "bg-teal-500",
  reminder: "bg-amber-500",
  other: "bg-ink-dim",
};
export const TYPE_CHIP: Record<CalendarEventType, string> = {
  interview: "bg-signal/10 text-signal border-signal/30",
  call: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800",
  deadline: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800",
  reminder: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  other: "bg-surface-2 text-ink-dim border-grid",
};
// A Record (not a template literal) so each value stays a literal key i18next's typed t() can
// verify against calendar.json — same trick as shared/fit-tone.ts's FIT_KEY, for the same reason.
export const TYPE_KEY: Record<
  CalendarEventType,
  "eventType.interview" | "eventType.call" | "eventType.deadline" | "eventType.reminder" | "eventType.other"
> = {
  interview: "eventType.interview",
  call: "eventType.call",
  deadline: "eventType.deadline",
  reminder: "eventType.reminder",
  other: "eventType.other",
};

/** pink-500, not violet-500 — the vacancy-step dot renders directly alongside the event dots (same
 * day cell) and violet sits only ~14° from the --star indigo on the hue wheel (they used to be far
 * apart under the old coral accent) — indistinguishable at dot size. Pink sits in the largest open
 * gap against the whole TYPE_DOT set (indigo/sky/teal/amber/gray). */
export const STEP_DOT = "bg-pink-500";

/** The two derived (non-event) marker kinds the legend can filter, alongside the five event
 * types. They're read-only projections of other features — a vacancy's next-step date and the
 * SRS review queue — so they can be hidden but never edited from here. */
export type CalendarMarker = CalendarEventType | "vacancyStep" | "srsDue";

/**
 * How a networking contact is labelled wherever a calendar event points at one: "Name — Role ·
 * Company". The employer is the part that actually disambiguates — two contacts called
 * "Viktoriia — Recruiter" are the same string without it. It comes from the contact's own company
 * link, falling back to the company on its linked vacancy, which is how most recruiter contacts
 * are attached in practice (see features/contacts/contacts.tsx).
 */
export function contactLabel(contact: Contact, companies: Company[], vacancies: Vacancy[]): string {
  const company =
    contact.companyId != null
      ? companies.find((c) => c.id === contact.companyId)?.name
      : vacancies.find((v) => v.id === contact.vacancyId)?.company;
  return [[contact.name, contact.role].filter(Boolean).join(" — "), company].filter(Boolean).join(" · ");
}
