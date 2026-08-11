// Repository wrapping the `calendar_events` table — manual calendar entries only (interview/
// call/deadline/reminder/other). Read-only items derived from other tables (a vacancy's `next`
// date, SRS due-cards) never live here — see calendar.service.ts for those. Every function is
// scoped by `userId` (see server/src/db/user-id.ts), matching every other repo in this codebase.
import { and, eq, gte, lte } from "drizzle-orm";
import db from "../../db/client.js";
import { calendarEvents } from "../../db/schema/index.js";
import type { UserId } from "../../db/user-id.js";
import type { CalendarEventInput } from "../../shared/validation.js";

export interface CalendarEvent {
  id: number;
  title: string;
  notes: string;
  startAt: string;
  endAt: string | null;
  type: string;
  /** Video-call link (Meet/Zoom/Teams/…), or "" when the event has none. */
  meetingUrl: string;
  vacancyId: number | null;
  contactId: number | null;
}

/** `from`/`to` are inclusive ISO instants — omit either to leave that side of the range open. */
export interface DateRange {
  from?: string;
  to?: string;
}

export async function listCalendarEvents(userId: UserId, range: DateRange = {}): Promise<CalendarEvent[]> {
  const conditions = [eq(calendarEvents.userId, userId)];
  if (range.from) conditions.push(gte(calendarEvents.startAt, range.from));
  if (range.to) conditions.push(lte(calendarEvents.startAt, range.to));
  return db
    .select()
    .from(calendarEvents)
    .where(and(...conditions))
    .orderBy(calendarEvents.startAt);
}

export async function getCalendarEvent(userId: UserId, id: number): Promise<CalendarEvent | undefined> {
  const [row] = await db
    .select()
    .from(calendarEvents)
    .where(and(eq(calendarEvents.userId, userId), eq(calendarEvents.id, id)));
  return row;
}

export interface NewCalendarEvent {
  title: string;
  notes: string;
  startAt: string;
  endAt: string | null;
  type: string;
  meetingUrl: string;
  vacancyId: number | null;
  contactId: number | null;
}

export async function createCalendarEvent(userId: UserId, input: NewCalendarEvent): Promise<CalendarEvent> {
  const [row] = await db
    .insert(calendarEvents)
    .values({ userId, ...input })
    .returning();
  return row!;
}

export async function updateCalendarEvent(userId: UserId, id: number, patch: CalendarEventInput): Promise<CalendarEvent | undefined> {
  const [row] = await db
    .update(calendarEvents)
    .set(patch)
    .where(and(eq(calendarEvents.userId, userId), eq(calendarEvents.id, id)))
    .returning();
  return row;
}

export async function deleteCalendarEvent(userId: UserId, id: number): Promise<number> {
  const deleted = await db
    .delete(calendarEvents)
    .where(and(eq(calendarEvents.userId, userId), eq(calendarEvents.id, id)))
    .returning({ id: calendarEvents.id });
  return deleted.length;
}
