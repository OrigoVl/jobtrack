import { describe, expect, it } from "vitest";
import {
  STALE_APPLICATION_DAYS,
  isStaleApplication,
  buildAnalyticsSummary,
  buildFocusSummary,
  heuristicFocus,
  FUNNEL_ORDER,
  FUNNEL_PROGRESSION_ORDER,
  FOCUS_ACTION_KINDS,
} from "./analytics.service.js";

describe("isStaleApplication()", () => {
  const nowMs = new Date("2026-08-04T00:00:00Z").getTime();

  it("is false for a status the candidate isn't waiting on (e.g. 'Want to apply')", () => {
    expect(isStaleApplication({ status: "Want to apply", applied: "2026-01-01", next: "" }, nowMs)).toBe(false);
  });

  it(`is false when applied less than ${STALE_APPLICATION_DAYS} days ago`, () => {
    const applied = new Date(nowMs - 5 * 86_400_000).toISOString();
    expect(isStaleApplication({ status: "Applied", applied, next: "" }, nowMs)).toBe(false);
  });

  it(`is true when a waiting-status vacancy has had no response for more than ${STALE_APPLICATION_DAYS} days`, () => {
    const applied = new Date(nowMs - 20 * 86_400_000).toISOString();
    expect(isStaleApplication({ status: "Applied", applied, next: "" }, nowMs)).toBe(true);
  });

  it("is false when there's no applied date at all", () => {
    expect(isStaleApplication({ status: "Applied", applied: "", next: "" }, nowMs)).toBe(false);
  });

  it("is false for a terminal status like 'Rejected' even if long silent", () => {
    const applied = new Date(nowMs - 30 * 86_400_000).toISOString();
    expect(isStaleApplication({ status: "Rejected", applied, next: "" }, nowMs)).toBe(false);
  });
});

describe("buildAnalyticsSummary()", () => {
  it("counts the CURRENT status distribution into funnel, distinct from funnelReached", () => {
    const rows = [
      { status: "Rejected", created: "2026-01-01", applied: "2026-01-01" },
      { status: "Applied", created: "2026-01-02", applied: "2026-01-02" },
    ];
    // one vacancy reached "Tech interview" at some point in its history before being rejected
    const reached = { "Tech interview": 1, Applied: 2, Rejected: 1 };
    const { funnel, funnelReached } = buildAnalyticsSummary(rows, reached);
    expect(funnel["Tech interview"]).toBe(0); // current snapshot: nothing is AT that stage now
    expect(funnelReached["Tech interview"]).toBe(1); // but one vacancy passed through it
    expect(funnel["Rejected"]).toBe(1);
  });

  it("groups byDate from each row's created date", () => {
    const rows = [
      { status: "Applied", created: "2026-01-01", applied: "" },
      { status: "Applied", created: "2026-01-01", applied: "" },
      { status: "Applied", created: "2026-01-02", applied: "" },
    ];
    const { byDate } = buildAnalyticsSummary(rows, {});
    expect(byDate).toEqual({ "2026-01-01": 2, "2026-01-02": 1 });
  });

  it("initializes every FUNNEL_ORDER stage to 0 even with no rows", () => {
    const { funnel, funnelReached } = buildAnalyticsSummary([], {});
    FUNNEL_ORDER.forEach((stage) => {
      expect(funnel[stage]).toBe(0);
      expect(funnelReached[stage]).toBe(0);
    });
  });

  it("excludes 'Rejected' from FUNNEL_PROGRESSION_ORDER (it's a terminal exit, not a funnel step)", () => {
    expect(FUNNEL_PROGRESSION_ORDER).not.toContain("Rejected");
    expect(FUNNEL_ORDER).toContain("Rejected");
  });
});

describe("buildFocusSummary()", () => {
  const today = "2026-08-04";
  const nowMs = new Date(`${today}T00:00:00Z`).getTime();

  it("computes overdue/upcoming from each row's `next` date against today", () => {
    const rows = [
      { status: "Applied", next: "2026-08-01", applied: "2026-07-20" },
      { status: "Applied", next: "2026-08-10", applied: "2026-07-20" },
    ];
    const summary = buildFocusSummary({ rows, demand: {}, gapPriority: {}, knownSkills: [], dueCards: 0, today, nowMs });
    expect(summary.overdue).toBe(1);
    expect(summary.upcoming).toBe(1);
  });

  it("gaps are the top-5 by gapPriority not already known, highest priority first, with demand's own count displayed", () => {
    const demand = { React: 10, Vue: 5, Go: 8, Rust: 1 };
    const summary = buildFocusSummary({ rows: [], demand, gapPriority: demand, knownSkills: ["React"], dueCards: 0, today, nowMs });
    expect(summary.gaps).toEqual(["Go (8)", "Vue (5)", "Rust (1)"]);
  });

  it("ranks gaps by gapPriority, NOT by raw demand — the two can disagree", () => {
    const summary = buildFocusSummary({
      rows: [],
      demand: { Docker: 10, AWS: 4 },
      gapPriority: { Docker: 1, AWS: 9 },
      knownSkills: [],
      dueCards: 0,
      today,
      nowMs,
    });
    expect(summary.gaps).toEqual(["AWS (4)", "Docker (10)"]);
  });

  it("counts interviews as vacancies in Tech interview/Take-home task/Final", () => {
    const rows = [
      { status: "Tech interview", next: "", applied: "2026-07-01" },
      { status: "Final", next: "", applied: "2026-07-01" },
      { status: "Applied", next: "", applied: "2026-07-01" },
    ];
    const summary = buildFocusSummary({ rows, demand: {}, gapPriority: {}, knownSkills: [], dueCards: 0, today, nowMs });
    expect(summary.interviews).toBe(2);
  });
});

describe("heuristicFocus()", () => {
  it("returns at most 3 actions even when every condition triggers", () => {
    const actions = heuristicFocus({
      totalVac: 1,
      interviews: 2,
      overdue: 3,
      upcoming: 0,
      funnel: {},
      gaps: ["React (5)"],
      skillsCount: 1,
      dueCards: 4,
      staleApplications: 5,
    });
    expect(actions.length).toBe(3);
  });

  it("returns no actions when nothing is actionable", () => {
    const actions = heuristicFocus({
      totalVac: 10,
      interviews: 0,
      overdue: 0,
      upcoming: 0,
      funnel: {},
      gaps: [],
      skillsCount: 5,
      dueCards: 0,
      staleApplications: 0,
    });
    expect(actions).toEqual([]);
  });

  it("prioritizes overdue steps first when present", () => {
    const actions = heuristicFocus({
      totalVac: 10,
      interviews: 1,
      overdue: 2,
      upcoming: 0,
      funnel: {},
      gaps: [],
      skillsCount: 5,
      dueCards: 0,
      staleApplications: 0,
    });
    expect(actions[0]?.title).toBe("Update 2 overdue steps");
  });

  // Every heuristic action must carry a `kind` — that's what makes it a click target on the
  // dashboard (client/src/features/dashboard/focus-destination.ts maps kind → route). An action
  // without one silently degrades to plain text, which is exactly the "tells you what to do but
  // not where" problem this field exists to fix.
  it("tags every action with a routable kind", () => {
    const actions = heuristicFocus({
      totalVac: 1,
      interviews: 2,
      overdue: 3,
      upcoming: 0,
      funnel: {},
      gaps: ["React (5)"],
      skillsCount: 1,
      dueCards: 4,
      staleApplications: 5,
    });
    expect(actions.length).toBeGreaterThan(0);
    actions.forEach((a) => expect(FOCUS_ACTION_KINDS).toContain(a.kind));
  });

  it("routes each condition to the area it is actually about", () => {
    const base = {
      totalVac: 10,
      interviews: 0,
      overdue: 0,
      upcoming: 0,
      funnel: {},
      gaps: [] as string[],
      skillsCount: 5,
      dueCards: 0,
      staleApplications: 0,
    };
    expect(heuristicFocus({ ...base, overdue: 1 })[0]?.kind).toBe("vacancies");
    expect(heuristicFocus({ ...base, interviews: 1 })[0]?.kind).toBe("interviews");
    expect(heuristicFocus({ ...base, gaps: ["React (5)"] })[0]?.kind).toBe("skills");
    expect(heuristicFocus({ ...base, dueCards: 1 })[0]?.kind).toBe("cards");
    expect(heuristicFocus({ ...base, staleApplications: 1 })[0]?.kind).toBe("contacts");
  });
});
