import { describe, expect, it } from "vitest";
import { looksLikeDesignInterview, findUpcomingDesignInterview } from "./design-reminders";
import type { CalendarEvent } from "./types";

const NOW = new Date("2026-08-04T12:00:00.000Z").getTime();

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 1,
    title: "Interview",
    notes: "",
    startAt: "2026-08-06T12:00:00.000Z",
    endAt: null,
    type: "interview",
    vacancyId: null,
    contactId: null,
    ...overrides,
  };
}

describe("looksLikeDesignInterview", () => {
  it("matches an interview whose title mentions system design", () => {
    expect(looksLikeDesignInterview(event({ title: "System design round" }))).toBe(true);
  });

  it("matches via notes, not just title", () => {
    expect(looksLikeDesignInterview(event({ title: "Round 2", notes: "This one is the architecture interview." }))).toBe(true);
  });

  it("matches the Ukrainian 'архітект' stem", () => {
    expect(looksLikeDesignInterview(event({ title: "Співбесіда з архітектури" }))).toBe(true);
  });

  it("does not match a non-interview event even if it mentions system design", () => {
    expect(looksLikeDesignInterview(event({ type: "reminder", title: "System design study session" }))).toBe(false);
  });

  it("does not match an ordinary interview with no design-related text", () => {
    expect(looksLikeDesignInterview(event({ title: "Behavioral round" }))).toBe(false);
  });
});

describe("findUpcomingDesignInterview", () => {
  it("finds a matching event within the lookahead window", () => {
    const events = [event({ title: "System design interview", startAt: new Date(NOW + 2 * 86_400_000).toISOString() })];
    expect(findUpcomingDesignInterview(events, NOW, 3)?.id).toBe(1);
  });

  it("excludes a matching event further out than the lookahead window", () => {
    const events = [event({ title: "System design interview", startAt: new Date(NOW + 10 * 86_400_000).toISOString() })];
    expect(findUpcomingDesignInterview(events, NOW, 3)).toBeNull();
  });

  it("excludes a matching event that already started", () => {
    const events = [event({ title: "System design interview", startAt: new Date(NOW - 60_000).toISOString() })];
    expect(findUpcomingDesignInterview(events, NOW, 3)).toBeNull();
  });

  it("returns the soonest match when there are several", () => {
    const events = [
      event({ id: 1, title: "System design", startAt: new Date(NOW + 2 * 86_400_000).toISOString() }),
      event({ id: 2, title: "Architecture round", startAt: new Date(NOW + 1 * 86_400_000).toISOString() }),
    ];
    expect(findUpcomingDesignInterview(events, NOW, 3)?.id).toBe(2);
  });

  it("returns null when nothing matches", () => {
    expect(findUpcomingDesignInterview([event({ title: "Behavioral round" })], NOW, 3)).toBeNull();
  });
});
