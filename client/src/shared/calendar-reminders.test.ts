import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findEventsToNotify, pruneNotified, getNotifiedEventIds, markNotified, REMINDER_WINDOW_MINUTES } from "./calendar-reminders";
import type { CalendarEvent } from "./types";

const NOW = new Date("2026-08-04T12:00:00.000Z").getTime();

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 1,
    title: "Interview",
    notes: "",
    startAt: "2026-08-04T12:10:00.000Z",
    endAt: null,
    type: "interview",
    vacancyId: null,
    ...overrides,
  };
}

describe("findEventsToNotify", () => {
  it("includes an event starting within the reminder window", () => {
    const events = [event({ startAt: new Date(NOW + 10 * 60_000).toISOString() })];
    expect(findEventsToNotify(events, NOW, new Set())).toHaveLength(1);
  });

  it("excludes an event further out than the reminder window", () => {
    const events = [event({ startAt: new Date(NOW + (REMINDER_WINDOW_MINUTES + 5) * 60_000).toISOString() })];
    expect(findEventsToNotify(events, NOW, new Set())).toHaveLength(0);
  });

  it("excludes an event that has already started", () => {
    const events = [event({ startAt: new Date(NOW - 60_000).toISOString() })];
    expect(findEventsToNotify(events, NOW, new Set())).toHaveLength(0);
  });

  it("excludes an event already in the notified set", () => {
    const events = [event({ id: 5, startAt: new Date(NOW + 5 * 60_000).toISOString() })];
    expect(findEventsToNotify(events, NOW, new Set([5]))).toHaveLength(0);
  });

  it("excludes an event with an unparseable startAt instead of throwing", () => {
    const events = [event({ startAt: "not-a-date" })];
    expect(findEventsToNotify(events, NOW, new Set())).toHaveLength(0);
  });

  it("includes an event exactly at the edge of the window (inclusive)", () => {
    const events = [event({ startAt: new Date(NOW + REMINDER_WINDOW_MINUTES * 60_000).toISOString() })];
    expect(findEventsToNotify(events, NOW, new Set())).toHaveLength(1);
  });
});

describe("pruneNotified", () => {
  it("keeps an entry whose event started less than 24h ago", () => {
    const map = { "1": new Date(NOW - 60_000).toISOString() };
    expect(pruneNotified(NOW, map)).toEqual(map);
  });

  it("drops an entry whose event started more than 24h ago", () => {
    const map = { "1": new Date(NOW - 25 * 60 * 60_000).toISOString() };
    expect(pruneNotified(NOW, map)).toEqual({});
  });

  it("drops an entry with an unparseable stored date rather than keeping it forever", () => {
    expect(pruneNotified(NOW, { "1": "garbage" })).toEqual({});
  });
});

describe("getNotifiedEventIds / markNotified (localStorage-backed)", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("is empty before anything has been marked notified", () => {
    expect(getNotifiedEventIds(NOW)).toEqual(new Set());
  });

  it("returns an id after it's been marked notified", () => {
    markNotified(event({ id: 42, startAt: new Date(NOW).toISOString() }));
    expect(getNotifiedEventIds(NOW)).toEqual(new Set([42]));
  });

  it("prunes an old notified entry on read", () => {
    markNotified(event({ id: 7, startAt: new Date(NOW - 25 * 60 * 60_000).toISOString() }));
    expect(getNotifiedEventIds(NOW)).toEqual(new Set());
  });
});
