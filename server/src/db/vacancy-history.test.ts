import { describe, expect, it, vi } from "vitest";

// vi.mock factories are hoisted above top-level const declarations — vi.hoisted() lets the
// mutable `rows` holder be shared between the factory and the tests below without a
// "Cannot access before initialization" error (same pattern as shared/demand.test.ts).
const { rows } = vi.hoisted(() => ({ rows: [] as unknown[] }));
vi.mock("./client.js", () => ({
  default: { prepare: () => ({ all: () => rows, run: vi.fn() }) },
}));

import { getFunnelConversion, getAvgDaysInStage } from "./vacancy-history.js";

describe("getFunnelConversion()", () => {
  it("returns 100% between two adjacent stages every vacancy that reached the first also reached", () => {
    rows.length = 0;
    rows.push({ status: "Want to apply", c: 5 }, { status: "Applied", c: 5 });
    const result = getFunnelConversion(["Want to apply", "Applied"]);
    expect(result).toEqual([{ from: "Want to apply", to: "Applied", rate: 100 }]);
  });

  it("computes a partial conversion rate when fewer vacancies reached the next stage", () => {
    rows.length = 0;
    rows.push({ status: "Applied", c: 4 }, { status: "Screening", c: 1 });
    const result = getFunnelConversion(["Applied", "Screening"]);
    expect(result).toEqual([{ from: "Applied", to: "Screening", rate: 25 }]);
  });

  it("returns null (not 0 or NaN) for a stage nothing has ever reached — avoids a misleading '0%'", () => {
    rows.length = 0;
    const result = getFunnelConversion(["Want to apply", "Applied"]);
    expect(result).toEqual([{ from: "Want to apply", to: "Applied", rate: null }]);
  });

  it("caps the rate at 100% even if `to` somehow has a higher reached-count than `from` (defensive)", () => {
    rows.length = 0;
    rows.push({ status: "Applied", c: 2 }, { status: "Screening", c: 5 });
    const result = getFunnelConversion(["Applied", "Screening"]);
    expect(result[0]?.rate).toBe(100);
  });

  it("produces one entry per adjacent pair for a longer order", () => {
    rows.length = 0;
    rows.push({ status: "A", c: 3 }, { status: "B", c: 2 }, { status: "C", c: 1 });
    const result = getFunnelConversion(["A", "B", "C"]);
    expect(result).toEqual([
      { from: "A", to: "B", rate: 67 },
      { from: "B", to: "C", rate: 50 },
    ]);
  });
});

describe("getAvgDaysInStage()", () => {
  it("computes the average number of days between consecutive status changes of the same vacancy", () => {
    rows.length = 0;
    rows.push(
      { vacancy_id: 1, status: "Applied", changed_at: "2026-01-01T00:00:00Z" },
      { vacancy_id: 1, status: "Screening", changed_at: "2026-01-05T00:00:00Z" },
    );
    const result = getAvgDaysInStage();
    expect(result).toEqual([{ status: "Applied", avgDays: 4, count: 1 }]);
  });

  it("averages across multiple vacancies that passed through the same stage", () => {
    rows.length = 0;
    rows.push(
      { vacancy_id: 1, status: "Screening", changed_at: "2026-01-01T00:00:00Z" },
      { vacancy_id: 1, status: "Tech interview", changed_at: "2026-01-03T00:00:00Z" }, // +2 days
      { vacancy_id: 2, status: "Screening", changed_at: "2026-01-01T00:00:00Z" },
      { vacancy_id: 2, status: "Tech interview", changed_at: "2026-01-07T00:00:00Z" }, // +6 days
    );
    const result = getAvgDaysInStage();
    expect(result).toEqual([{ status: "Screening", avgDays: 4, count: 2 }]);
  });

  it("does NOT pair the last status of one vacancy with the first status of the next (row-order boundary)", () => {
    rows.length = 0;
    rows.push(
      { vacancy_id: 1, status: "Final", changed_at: "2026-01-01T00:00:00Z" },
      { vacancy_id: 2, status: "Want to apply", changed_at: "2026-06-01T00:00:00Z" }, // very far away, different vacancy
    );
    const result = getAvgDaysInStage();
    expect(result).toEqual([]); // no valid within-vacancy pair for either row
  });

  it("sorts stages by descending average duration (longest wait first)", () => {
    rows.length = 0;
    rows.push(
      { vacancy_id: 1, status: "Screening", changed_at: "2026-01-01T00:00:00Z" },
      { vacancy_id: 1, status: "Tech interview", changed_at: "2026-01-02T00:00:00Z" }, // +1 day
      { vacancy_id: 2, status: "Final", changed_at: "2026-01-01T00:00:00Z" },
      { vacancy_id: 2, status: "Offer", changed_at: "2026-01-15T00:00:00Z" }, // +14 days
    );
    const result = getAvgDaysInStage();
    expect(result.map((r) => r.status)).toEqual(["Final", "Screening"]);
  });

  it("returns an empty array when there is no history at all", () => {
    rows.length = 0;
    expect(getAvgDaysInStage()).toEqual([]);
  });
});
