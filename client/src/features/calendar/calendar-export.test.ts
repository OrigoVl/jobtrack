import { describe, expect, it } from "vitest";
import { buildIcs, googleCalendarUrl, icsFileName, toIcsUtc } from "./calendar-export";
import type { CalendarEvent } from "../../shared/types";

const event = (over: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 42,
  title: "Interview at Acme",
  notes: "",
  startAt: "2026-07-15T12:00:00.000Z",
  endAt: null,
  type: "interview",
  vacancyId: null,
  contactId: null,
  ...over,
});

describe("toIcsUtc", () => {
  it("formats an ISO instant as UTC basic format", () => {
    expect(toIcsUtc("2026-07-15T12:00:00.000Z")).toBe("20260715T120000Z");
  });

  it("returns an empty string for an unparseable value rather than 'Invalid Date'", () => {
    expect(toIcsUtc("nope")).toBe("");
  });
});

describe("buildIcs", () => {
  const now = new Date("2026-07-01T00:00:00.000Z");

  it("produces a single-event VCALENDAR with CRLF line endings", () => {
    const ics = buildIcs(event(), now);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("\r\nEND:VCALENDAR")).toBe(true);
    expect(ics).toContain("SUMMARY:Interview at Acme");
    expect(ics).toContain("DTSTART:20260715T120000Z");
  });

  it("gives an event with no end time a one-hour block", () => {
    expect(buildIcs(event(), now)).toContain("DTEND:20260715T130000Z");
  });

  it("uses the real end time when there is one", () => {
    expect(buildIcs(event({ endAt: "2026-07-15T14:30:00.000Z" }), now)).toContain("DTEND:20260715T143000Z");
  });

  it("escapes the characters that would otherwise break the file", () => {
    const ics = buildIcs(event({ title: "Call: Acme, Inc; round 2", notes: "line one\nline two" }), now);
    expect(ics).toContain("SUMMARY:Call: Acme\\, Inc\\; round 2");
    expect(ics).toContain("DESCRIPTION:line one\\nline two");
    // The escaped newline must not have introduced a real one — the body would stop parsing there.
    expect(ics.split("\r\n").some((line) => line === "line two")).toBe(false);
  });

  it("omits DESCRIPTION entirely when there are no notes", () => {
    expect(buildIcs(event(), now)).not.toContain("DESCRIPTION");
  });

  it("keys the entry on the event id, so re-importing updates instead of duplicating", () => {
    expect(buildIcs(event(), now)).toContain("UID:zorya-event-42@zorya");
  });
});

describe("googleCalendarUrl", () => {
  it("builds a prefilled compose link", () => {
    const url = new URL(googleCalendarUrl(event({ endAt: "2026-07-15T13:00:00.000Z" })));
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe("Interview at Acme");
    expect(url.searchParams.get("dates")).toBe("20260715T120000Z/20260715T130000Z");
  });

  it("leaves out details when there are no notes", () => {
    expect(new URL(googleCalendarUrl(event())).searchParams.has("details")).toBe(false);
  });
});

describe("icsFileName", () => {
  it("slugifies the title", () => {
    expect(icsFileName(event({ title: "Interview at Acme" }))).toBe("interview-at-acme.ics");
  });

  it("keeps Cyrillic, which is a normal title in this app", () => {
    expect(icsFileName(event({ title: "Співбесіда" }))).toBe("співбесіда.ics");
  });

  it("falls back to the id when the title has nothing usable in it", () => {
    expect(icsFileName(event({ title: "!!!" }))).toBe("event-42.ics");
  });
});
