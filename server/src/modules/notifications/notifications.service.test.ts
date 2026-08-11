// The timing rules are the part of this feature that's easy to get subtly wrong and impossible to
// notice in production (a reminder that never fires looks exactly like one nobody needed), so they
// get direct tests rather than being exercised only through the scheduler.
import { describe, expect, it } from "vitest";
import {
  buildInterviewReminders,
  buildNextStepReminders,
  buildStaleReminders,
  buildStreakReminder,
  pickDueThreshold,
  STREAK_REMINDER_HOUR,
} from "./notifications.service.js";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.parse("2026-03-10T12:00:00.000Z");

describe("pickDueThreshold()", () => {
  it("returns nothing while the event is further out than every threshold", () => {
    expect(pickDueThreshold(NOW + 3 * DAY, NOW)).toBeNull();
  });

  it("returns the 24h slot once the event is inside a day", () => {
    expect(pickDueThreshold(NOW + 23 * HOUR, NOW)?.slug).toBe("24h");
  });

  it("returns only the MOST urgent slot for an event created inside the final hour", () => {
    // The 24h threshold is also crossed here — firing both would mean two notifications back to
    // back for one event, which is the bug this rule exists to prevent.
    expect(pickDueThreshold(NOW + 30 * 60 * 1000, NOW)?.slug).toBe("1h");
  });

  it("returns nothing once the event has already started", () => {
    expect(pickDueThreshold(NOW - 1, NOW)).toBeNull();
  });
});

describe("buildInterviewReminders()", () => {
  const event = { id: 42, title: "Onsite at Acme", startAt: new Date(NOW + 23 * HOUR).toISOString() };

  it("keys the reminder by event AND threshold so the 1h slot isn't blocked by the 24h one", () => {
    const [reminder] = buildInterviewReminders([event], "UTC", NOW);
    expect(reminder?.dedupeKey).toBe("interview:42:24h");
    const [later] = buildInterviewReminders([event], "UTC", NOW + 22.5 * HOUR);
    expect(later?.dedupeKey).toBe("interview:42:1h");
  });

  it("leaves the dedupe permanent (no TTL) — a crossed threshold must never re-arm", () => {
    expect(buildInterviewReminders([event], "UTC", NOW)[0]?.dedupeTtlMs).toBeUndefined();
  });

  it("skips an unparseable start time instead of emitting an Invalid Date reminder", () => {
    expect(buildInterviewReminders([{ id: 1, title: "x", startAt: "not-a-date" }], "UTC", NOW)).toEqual([]);
  });

  it("treats an event with no explicit type as an interview, as it always did", () => {
    const [reminder] = buildInterviewReminders([event], "UTC", NOW);
    expect(reminder?.kind).toBe("interview");
    expect(reminder?.text).toContain("📅 Interview tomorrow: Onsite at Acme");
  });

  it("reminds about non-interview events too, under their own opt-outable kind", () => {
    const call = { ...event, id: 7, type: "call", title: "Recruiter call" };
    const [reminder] = buildInterviewReminders([call], "UTC", NOW);
    expect(reminder?.kind).toBe("event");
    expect(reminder?.dedupeKey).toBe("event:7:24h");
    expect(reminder?.text).toContain("📞 Call tomorrow: Recruiter call");
  });

  it("words each event type in its own terms", () => {
    const types = ["deadline", "reminder", "other"].map((type) => buildInterviewReminders([{ ...event, type }], "UTC", NOW)[0]?.text);
    expect(types[0]).toContain("⏳ Deadline");
    expect(types[1]).toContain("🔔 Reminder");
    expect(types[2]).toContain("📌 Event");
  });

  it("falls back to the neutral wording for a type it doesn't know", () => {
    expect(buildInterviewReminders([{ ...event, type: "no-such-type" }], "UTC", NOW)[0]?.text).toContain("📌 Event");
  });
});

describe("buildNextStepReminders()", () => {
  const rows = [
    { id: 1, company: "Acme", position: "Backend", status: "Applied", applied: "2026-03-01", next: "2026-03-10" },
    { id: 2, company: "Globex", position: "Platform", status: "Applied", applied: "2026-03-01", next: "2026-03-01" },
    { id: 3, company: "Initech", position: "SRE", status: "Applied", applied: "2026-03-01", next: "" },
  ];

  it("fires only for a next step landing on the user's local today", () => {
    const out = buildNextStepReminders(rows, "UTC", NOW);
    expect(out.map((n) => n.dedupeKey)).toEqual(["next:1:2026-03-10"]);
  });

  it("resolves 'today' in the USER's zone, not the server's", () => {
    // The same instant is still 2026-03-10 in Kyiv but already 2026-03-11 in Kiritimati (UTC+14),
    // so a next step dated the 10th is due for one user and already behind the other.
    expect(buildNextStepReminders(rows, "Europe/Kyiv", NOW)).toHaveLength(1);
    expect(buildNextStepReminders(rows, "Pacific/Kiritimati", NOW)).toHaveLength(0);
  });

  it("falls back to UTC for a user whose browser never reported a zone", () => {
    expect(buildNextStepReminders(rows, null, NOW).map((n) => n.dedupeKey)).toEqual(["next:1:2026-03-10"]);
  });

  it("puts the date in the key so moving a next step legitimately re-arms it", () => {
    const moved = [{ ...rows[0]!, next: "2026-03-11" }];
    expect(buildNextStepReminders(moved, "UTC", NOW + DAY)[0]?.dedupeKey).toBe("next:1:2026-03-11");
  });
});

describe("buildStaleReminders()", () => {
  // isStaleApplication's threshold is 14 days on a waiting status.
  const stale = (id: number, appliedDaysAgo: number) => ({
    id,
    company: `Co${id}`,
    position: "Dev",
    status: "Applied",
    applied: new Date(NOW - appliedDaysAgo * DAY).toISOString().slice(0, 10),
    next: "",
  });

  it("reports only the longest-waiting application, not the whole list", () => {
    const out = buildStaleReminders([stale(1, 20), stale(2, 40), stale(3, 30)], NOW);
    expect(out).toHaveLength(1);
    expect(out[0]?.dedupeKey).toBe("stale:2");
    expect(out[0]?.text).toContain("2 other applications also waiting");
  });

  it("debounces rather than latching, so it can nag again next week", () => {
    expect(buildStaleReminders([stale(1, 20)], NOW)[0]?.dedupeTtlMs).toBe(7 * DAY);
  });

  it("says nothing when no application has gone quiet", () => {
    expect(buildStaleReminders([stale(1, 2)], NOW)).toEqual([]);
  });

  it("ignores a closed application — 'Rejected' is not waiting on anyone", () => {
    expect(buildStaleReminders([{ ...stale(1, 60), status: "Rejected" }], NOW)).toEqual([]);
  });
});

describe("buildStreakReminder()", () => {
  const evening = Date.parse("2026-03-10T20:00:00.000Z");
  const streak = { current: 12, longest: 20, lastActiveDate: "2026-03-09" };

  it("nudges in the evening when today has no activity yet", () => {
    const out = buildStreakReminder(streak, 8, "UTC", evening);
    expect(out?.dedupeKey).toBe("streak:2026-03-10");
    expect(out?.text).toContain("12-day streak");
    expect(out?.text).toContain("8 cards");
  });

  it("stays quiet before the evening cutoff", () => {
    const beforeCutoff = Date.parse(`2026-03-10T${String(STREAK_REMINDER_HOUR - 2).padStart(2, "0")}:00:00.000Z`);
    expect(buildStreakReminder(streak, 8, "UTC", beforeCutoff)).toBeNull();
  });

  it("stays quiet once today is already recorded", () => {
    expect(buildStreakReminder({ ...streak, lastActiveDate: "2026-03-10" }, 8, "UTC", evening)).toBeNull();
  });

  it("stays quiet when there is no streak to lose", () => {
    expect(buildStreakReminder({ current: 0, longest: 3, lastActiveDate: "" }, 8, "UTC", evening)).toBeNull();
  });

  it("omits the card count entirely when nothing is due", () => {
    expect(buildStreakReminder(streak, 0, "UTC", evening)?.text).not.toContain("due for review");
  });

  it("uses the user's local evening, not the server's", () => {
    // 20:00Z is 12:00 in Los Angeles — mid-day there, so no nudge yet.
    expect(buildStreakReminder(streak, 1, "America/Los_Angeles", evening)).toBeNull();
  });
});
