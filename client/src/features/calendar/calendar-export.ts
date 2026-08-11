// Handing a calendar event to whatever calendar the user actually lives in: an .ics file (the
// interchange format every calendar app imports) and a Google Calendar "add event" link. Pure
// string building — no dependency, no server round-trip; see calendar-export.test.ts.
import type { CalendarEvent } from "../../shared/types";
import { normalizeMeetingUrl } from "./meeting-link";

/** Default length given to an event with no end time, so an exported entry occupies a sane block
 * instead of a zero-width instant that some calendars render as an all-day item. */
const DEFAULT_DURATION_MS = 60 * 60 * 1000;

/** UTC "YYYYMMDDTHHMMSSZ" — the only form both RFC 5545 and Google's link API take without also
 * needing a VTIMEZONE definition or a separate `ctz` parameter. */
export function toIcsUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

/** RFC 5545 §3.3.11 text escaping: backslash, semicolon and comma are escaped, and real newlines
 * become the literal two-character "\n" — an unescaped one would end the property line and make
 * the file unparseable. */
function escapeIcsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function endOf(event: Pick<CalendarEvent, "startAt" | "endAt">): string {
  if (event.endAt) return event.endAt;
  const start = new Date(event.startAt);
  return Number.isNaN(start.getTime()) ? event.startAt : new Date(start.getTime() + DEFAULT_DURATION_MS).toISOString();
}

/**
 * A complete single-event VCALENDAR document. CRLF line endings are not cosmetic — RFC 5545
 * requires them, and some importers (Outlook notably) reject a file that uses bare LF.
 *
 * `uid` ties the exported entry back to this app's row, so re-importing an edited event updates
 * the existing entry in the target calendar instead of creating a duplicate.
 */
export function buildIcs(
  event: Pick<CalendarEvent, "id" | "title" | "notes" | "startAt" | "endAt" | "meetingUrl">,
  now = new Date(),
): string {
  const meetingUrl = normalizeMeetingUrl(event.meetingUrl);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Zorya//Calendar//EN",
    "BEGIN:VEVENT",
    `UID:zorya-event-${event.id}@zorya`,
    `DTSTAMP:${toIcsUtc(now.toISOString())}`,
    `DTSTART:${toIcsUtc(event.startAt)}`,
    `DTEND:${toIcsUtc(endOf(event))}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    ...(event.notes ? [`DESCRIPTION:${escapeIcsText(event.notes)}`] : []),
    // The call link goes in BOTH properties on purpose: LOCATION is what calendar apps actually
    // surface as the tappable "join" affordance on a reminder, while URL is the property RFC 5545
    // defines for it and the one importers read back. LOCATION is TEXT (escaped), URL is a URI
    // value — escaping the latter would corrupt a link containing a comma or semicolon.
    ...(meetingUrl ? [`LOCATION:${escapeIcsText(meetingUrl)}`, `URL:${meetingUrl}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/** A "create this event" link for Google Calendar's web UI — opens their compose screen with the
 * fields pre-filled, which is what most people want when the target calendar is Google's rather
 * than a desktop app that reads .ics. */
export function googleCalendarUrl(event: Pick<CalendarEvent, "title" | "notes" | "startAt" | "endAt" | "meetingUrl">): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toIcsUtc(event.startAt)}/${toIcsUtc(endOf(event))}`,
  });
  if (event.notes) params.set("details", event.notes);
  // `location` is the field Google's own event UI renders as a join button when it holds a
  // conferencing link — the same role LOCATION plays in the .ics above.
  const meetingUrl = normalizeMeetingUrl(event.meetingUrl);
  if (meetingUrl) params.set("location", meetingUrl);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** A filesystem-safe .ics filename built from the event's own title, so a downloads folder full of
 * these is still readable. Falls back to the id when the title is empty or all punctuation. */
export function icsFileName(event: Pick<CalendarEvent, "id" | "title">): string {
  const slug = event.title
    .toLowerCase()
    .replace(/[^a-z0-9\u0400-\u04FF]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || `event-${event.id}`}.ics`;
}
