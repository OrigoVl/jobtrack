import { describe, expect, it, vi } from "vitest";

// computeFunnelConversion()/avgDaysFromHistoryRows() are pure and never touch the DB, but this
// file still has a top-level `import db from "./client.js"` for the getFunnelConversion()/
// getAvgDaysInStage() wrappers (untested here) — and that import chain currently resolves to
// node:sqlite, which vitest can't transform. This mock only exists to satisfy module
// resolution; it's never exercised by the tests below. It goes away once db/client.ts moves
// off node:sqlite onto Postgres/Drizzle (a plain npm package).
vi.mock("./client.js", () => ({ default: { prepare: () => ({ all: () => [], run: vi.fn() }) } }));

import { computeFunnelConversion, avgDaysFromHistoryRows } from "./vacancy-history.js";

describe("computeFunnelConversion()", () => {
  it("returns 100% between two adjacent stages every vacancy that reached the first also reached", () => {
    const result = computeFunnelConversion({ "Want to apply": 5, Applied: 5 }, ["Want to apply", "Applied"]);
    expect(result).toEqual([{ from: "Want to apply", to: "Applied", rate: 100 }]);
  });

  it("computes a partial conversion rate when fewer vacancies reached the next stage", () => {
    const result = computeFunnelConversion({ Applied: 4, Screening: 1 }, ["Applied", "Screening"]);
    expect(result).toEqual([{ from: "Applied", to: "Screening", rate: 25 }]);
  });

  it("returns null (not 0 or NaN) for a stage nothing has ever reached — avoids a misleading '0%'", () => {
    const result = computeFunnelConversion({}, ["Want to apply", "Applied"]);
    expect(result).toEqual([{ from: "Want to apply", to: "Applied", rate: null }]);
  });

  it("caps the rate at 100% even if `to` somehow has a higher reached-count than `from` (defensive)", () => {
    const result = computeFunnelConversion({ Applied: 2, Screening: 5 }, ["Applied", "Screening"]);
    expect(result[0]?.rate).toBe(100);
  });

  it("produces one entry per adjacent pair for a longer order", () => {
    const result = computeFunnelConversion({ A: 3, B: 2, C: 1 }, ["A", "B", "C"]);
    expect(result).toEqual([
      { from: "A", to: "B", rate: 67 },
      { from: "B", to: "C", rate: 50 },
    ]);
  });
});

describe("avgDaysFromHistoryRows()", () => {
  it("computes the average number of days between consecutive status changes of the same vacancy", () => {
    const rows = [
      { vacancy_id: 1, status: "Applied", changed_at: new Date("2026-01-01T00:00:00Z") },
      { vacancy_id: 1, status: "Screening", changed_at: new Date("2026-01-05T00:00:00Z") },
    ];
    const result = avgDaysFromHistoryRows(rows);
    expect(result).toEqual([{ status: "Applied", avgDays: 4, count: 1 }]);
  });

  it("averages across multiple vacancies that passed through the same stage", () => {
    const rows = [
      { vacancy_id: 1, status: "Screening", changed_at: new Date("2026-01-01T00:00:00Z") },
      { vacancy_id: 1, status: "Tech interview", changed_at: new Date("2026-01-03T00:00:00Z") }, // +2 days
      { vacancy_id: 2, status: "Screening", changed_at: new Date("2026-01-01T00:00:00Z") },
      { vacancy_id: 2, status: "Tech interview", changed_at: new Date("2026-01-07T00:00:00Z") }, // +6 days
    ];
    const result = avgDaysFromHistoryRows(rows);
    expect(result).toEqual([{ status: "Screening", avgDays: 4, count: 2 }]);
  });

  it("does NOT pair the last status of one vacancy with the first status of the next (row-order boundary)", () => {
    const rows = [
      { vacancy_id: 1, status: "Final", changed_at: new Date("2026-01-01T00:00:00Z") },
      { vacancy_id: 2, status: "Want to apply", changed_at: new Date("2026-06-01T00:00:00Z") }, // very far away, different vacancy
    ];
    const result = avgDaysFromHistoryRows(rows);
    expect(result).toEqual([]); // no valid within-vacancy pair for either row
  });

  it("sorts stages by descending average duration (longest wait first)", () => {
    const rows = [
      { vacancy_id: 1, status: "Screening", changed_at: new Date("2026-01-01T00:00:00Z") },
      { vacancy_id: 1, status: "Tech interview", changed_at: new Date("2026-01-02T00:00:00Z") }, // +1 day
      { vacancy_id: 2, status: "Final", changed_at: new Date("2026-01-01T00:00:00Z") },
      { vacancy_id: 2, status: "Offer", changed_at: new Date("2026-01-15T00:00:00Z") }, // +14 days
    ];
    const result = avgDaysFromHistoryRows(rows);
    expect(result.map((r) => r.status)).toEqual(["Final", "Screening"]);
  });

  it("returns an empty array when there is no history at all", () => {
    expect(avgDaysFromHistoryRows([])).toEqual([]);
  });
});
