import { describe, expect, it } from "vitest";
import {
  isDigestDue,
  buildStaleApplications,
  buildUpcomingItems,
  hasDigestContent,
  digestHtml,
  type VacancyDigestRow,
  type DigestContent,
} from "./digest.service.js";

const NOW = new Date("2026-08-04T00:00:00.000Z").getTime();

function vacancy(overrides: Partial<VacancyDigestRow> = {}): VacancyDigestRow {
  return { id: 1, company: "Acme", position: "Engineer", status: "Applied", applied: "2026-07-01", ...overrides };
}

describe("isDigestDue", () => {
  it("is due immediately when never sent before", () => {
    expect(isDigestDue(null, NOW)).toBe(true);
  });

  it("is not due before a week has passed", () => {
    expect(isDigestDue(new Date(NOW - 3 * 86_400_000).toISOString(), NOW)).toBe(false);
  });

  it("is due once a week (or more) has passed", () => {
    expect(isDigestDue(new Date(NOW - 7 * 86_400_000).toISOString(), NOW)).toBe(true);
    expect(isDigestDue(new Date(NOW - 30 * 86_400_000).toISOString(), NOW)).toBe(true);
  });
});

describe("buildStaleApplications", () => {
  it("only includes vacancies past the stale threshold in a waiting status", () => {
    const rows = [
      vacancy({ id: 1, applied: new Date(NOW - 20 * 86_400_000).toISOString() }), // stale
      vacancy({ id: 2, applied: new Date(NOW - 2 * 86_400_000).toISOString() }), // too recent
      vacancy({ id: 3, status: "Offer", applied: new Date(NOW - 30 * 86_400_000).toISOString() }), // terminal status
    ];
    const stale = buildStaleApplications(rows, NOW);
    expect(stale.map((s) => s.id)).toEqual([1]);
  });

  it("sorts longest-waiting first", () => {
    const rows = [
      vacancy({ id: 1, company: "A", applied: new Date(NOW - 15 * 86_400_000).toISOString() }),
      vacancy({ id: 2, company: "B", applied: new Date(NOW - 40 * 86_400_000).toISOString() }),
    ];
    const stale = buildStaleApplications(rows, NOW);
    expect(stale.map((s) => s.company)).toEqual(["B", "A"]);
  });

  it("reports a plausible daysWaiting count", () => {
    const stale = buildStaleApplications([vacancy({ applied: new Date(NOW - 21 * 86_400_000).toISOString() })], NOW);
    expect(stale[0]!.daysWaiting).toBe(21);
  });
});

describe("buildUpcomingItems", () => {
  it("combines vacancy next-steps and interview events into one chronological list", () => {
    const items = buildUpcomingItems({
      vacancyNextSteps: [{ company: "Acme", position: "Engineer", date: "2026-08-10" }],
      interviewEvents: [{ title: "Onsite with Beta Corp", startAt: "2026-08-06T10:00:00.000Z" }],
    });
    expect(items).toEqual([
      { label: "Onsite with Beta Corp", date: "2026-08-06" },
      { label: "Acme — Engineer", date: "2026-08-10" },
    ]);
  });

  it("falls back to a generic label for an untitled interview event", () => {
    const items = buildUpcomingItems({ vacancyNextSteps: [], interviewEvents: [{ title: "", startAt: "2026-08-06T10:00:00.000Z" }] });
    expect(items[0]!.label).toBe("Interview");
  });
});

describe("hasDigestContent", () => {
  const emptyStreak = { current: 0, longest: 0, lastActiveDate: "" };

  it("is false when there's nothing stale or upcoming, even with an active streak", () => {
    const content: DigestContent = {
      staleApplications: [],
      streak: { current: 5, longest: 5, lastActiveDate: "2026-08-03" },
      upcoming: [],
    };
    expect(hasDigestContent(content)).toBe(false);
  });

  it("is true when there's a stale application", () => {
    const content: DigestContent = {
      staleApplications: [{ id: 1, company: "Acme", position: "Engineer", daysWaiting: 20 }],
      streak: emptyStreak,
      upcoming: [],
    };
    expect(hasDigestContent(content)).toBe(true);
  });

  it("is true when there's an upcoming item", () => {
    const content: DigestContent = {
      staleApplications: [],
      streak: emptyStreak,
      upcoming: [{ label: "Acme — Engineer", date: "2026-08-10" }],
    };
    expect(hasDigestContent(content)).toBe(true);
  });
});

describe("digestHtml", () => {
  it("escapes company/position names to prevent HTML injection", () => {
    const html = digestHtml({
      staleApplications: [{ id: 1, company: "<script>alert(1)</script>", position: "Engineer", daysWaiting: 20 }],
      streak: { current: 0, longest: 0, lastActiveDate: "" },
      upcoming: [],
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("includes a streak line only when the streak is active", () => {
    const withStreak = digestHtml({
      staleApplications: [],
      streak: { current: 3, longest: 3, lastActiveDate: "2026-08-03" },
      upcoming: [],
    });
    const withoutStreak = digestHtml({ staleApplications: [], streak: { current: 0, longest: 0, lastActiveDate: "" }, upcoming: [] });
    expect(withStreak).toContain("3-day study streak");
    expect(withoutStreak).toBe("");
  });
});
