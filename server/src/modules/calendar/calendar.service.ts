// Combines manual calendar events with READ-ONLY calendar-relevant dates that already exist
// elsewhere in the app — a vacancy's `next` (next-step) date and SRS due-cards — into one
// unified view, WITHOUT duplicating storage: both are computed on the fly from their own
// tables/repos every time, never copied into calendar_events. Deliberately NOT surfacing
// plan21 days here — those are relative day-numbers ("Day 3"), not real calendar dates (see
// modules/plan21/plan-builder.service.ts), so inventing a date for them would be fabricating
// data this feature doesn't actually have.
import { listVacancies } from "../vacancies/vacancies.repo.js";
import { allCards } from "../study/content-store.js";
import { getSrsStateByCard } from "../../db/index.js";
import type { UserId } from "../../db/user-id.js";
import type { VacancyRow, SrsRow } from "../../db/types.js";
import type { Card } from "../study/content.js";
import { listCalendarEvents, type CalendarEvent, type DateRange } from "./calendar.repo.js";

export interface VacancyNextStep {
  vacancyId: number;
  company: string;
  position: string;
  /** ISO date (YYYY-MM-DD) — vacancies.next's own format, see shared/validation.ts#toDateOrEmpty. */
  date: string;
}

export interface SrsDueDay {
  /** ISO date (YYYY-MM-DD) — srs.due's own format. */
  date: string;
  count: number;
}

export interface CombinedCalendar {
  events: CalendarEvent[];
  vacancyNextSteps: VacancyNextStep[];
  srsDue: SrsDueDay[];
}

/** Plain YYYY-MM-DD range — matches how `vacancies.next`/`srs.due` are already stored and
 * compared everywhere else in the app (analytics.routes.ts, dashboard.tsx). */
export interface DayRange {
  from?: string;
  to?: string;
}

function inRange(date: string, range: DayRange): boolean {
  if (range.from && date < range.from) return false;
  if (range.to && date > range.to) return false;
  return true;
}

/** Pure — every vacancy with a `next` date set, projected down to the calendar's shape. Exported
 * for unit testing without a DB. */
export function buildVacancyNextSteps(vacancies: VacancyRow[], range: DayRange = {}): VacancyNextStep[] {
  return vacancies
    .filter((v) => v.next && inRange(v.next, range))
    .map((v) => ({ vacancyId: v.id, company: v.company, position: v.position, date: v.next }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Pure — groups cards by their recorded SRS `due` date. A card with no SRS state yet (never
 * reviewed) has no real due date — it's excluded rather than fabricating one at "today" or
 * "whenever". Exported for unit testing without a DB. */
export function buildSrsDueDays(cards: Card[], state: Record<string, SrsRow>, range: DayRange = {}): SrsDueDay[] {
  const counts = new Map<string, number>();
  for (const c of cards) {
    const due = state[c.id]?.due;
    if (!due || !inRange(due, range)) continue;
    counts.set(due, (counts.get(due) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function toDayRange(range: DateRange): DayRange {
  return {
    from: range.from ? range.from.slice(0, 10) : undefined,
    to: range.to ? range.to.slice(0, 10) : undefined,
  };
}

/** Assembles the whole combined view for one user: their own manual events, plus the two
 * read-only derived sources above, all scoped to the same optional date range. */
export async function getCombinedCalendar(userId: UserId, range: DateRange = {}): Promise<CombinedCalendar> {
  const dayRange = toDayRange(range);
  const [events, vacancies, cards, srsState] = await Promise.all([
    listCalendarEvents(userId, range),
    listVacancies(userId),
    allCards(userId),
    getSrsStateByCard(userId),
  ]);
  return {
    events,
    vacancyNextSteps: buildVacancyNextSteps(vacancies, dayRange),
    srsDue: buildSrsDueDays(cards, srsState, dayRange),
  };
}
