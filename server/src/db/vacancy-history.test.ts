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
    rows.push({ status: "Хочу подати", c: 5 }, { status: "Відправив CV", c: 5 });
    const result = getFunnelConversion(["Хочу подати", "Відправив CV"]);
    expect(result).toEqual([{ from: "Хочу подати", to: "Відправив CV", rate: 100 }]);
  });

  it("computes a partial conversion rate when fewer vacancies reached the next stage", () => {
    rows.length = 0;
    rows.push({ status: "Відправив CV", c: 4 }, { status: "Скринінг", c: 1 });
    const result = getFunnelConversion(["Відправив CV", "Скринінг"]);
    expect(result).toEqual([{ from: "Відправив CV", to: "Скринінг", rate: 25 }]);
  });

  it("returns null (not 0 or NaN) for a stage nothing has ever reached — avoids a misleading '0%'", () => {
    rows.length = 0;
    const result = getFunnelConversion(["Хочу подати", "Відправив CV"]);
    expect(result).toEqual([{ from: "Хочу подати", to: "Відправив CV", rate: null }]);
  });

  it("caps the rate at 100% even if `to` somehow has a higher reached-count than `from` (defensive)", () => {
    rows.length = 0;
    rows.push({ status: "Відправив CV", c: 2 }, { status: "Скринінг", c: 5 });
    const result = getFunnelConversion(["Відправив CV", "Скринінг"]);
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
      { vacancy_id: 1, status: "Відправив CV", changed_at: "2026-01-01T00:00:00Z" },
      { vacancy_id: 1, status: "Скринінг", changed_at: "2026-01-05T00:00:00Z" },
    );
    const result = getAvgDaysInStage();
    expect(result).toEqual([{ status: "Відправив CV", avgDays: 4, count: 1 }]);
  });

  it("averages across multiple vacancies that passed through the same stage", () => {
    rows.length = 0;
    rows.push(
      { vacancy_id: 1, status: "Скринінг", changed_at: "2026-01-01T00:00:00Z" },
      { vacancy_id: 1, status: "Тех.співбесіда", changed_at: "2026-01-03T00:00:00Z" }, // +2 days
      { vacancy_id: 2, status: "Скринінг", changed_at: "2026-01-01T00:00:00Z" },
      { vacancy_id: 2, status: "Тех.співбесіда", changed_at: "2026-01-07T00:00:00Z" }, // +6 days
    );
    const result = getAvgDaysInStage();
    expect(result).toEqual([{ status: "Скринінг", avgDays: 4, count: 2 }]);
  });

  it("does NOT pair the last status of one vacancy with the first status of the next (row-order boundary)", () => {
    rows.length = 0;
    rows.push(
      { vacancy_id: 1, status: "Фінал", changed_at: "2026-01-01T00:00:00Z" },
      { vacancy_id: 2, status: "Хочу подати", changed_at: "2026-06-01T00:00:00Z" }, // very far away, different vacancy
    );
    const result = getAvgDaysInStage();
    expect(result).toEqual([]); // no valid within-vacancy pair for either row
  });

  it("sorts stages by descending average duration (longest wait first)", () => {
    rows.length = 0;
    rows.push(
      { vacancy_id: 1, status: "Скринінг", changed_at: "2026-01-01T00:00:00Z" },
      { vacancy_id: 1, status: "Тех.співбесіда", changed_at: "2026-01-02T00:00:00Z" }, // +1 day
      { vacancy_id: 2, status: "Фінал", changed_at: "2026-01-01T00:00:00Z" },
      { vacancy_id: 2, status: "Оффер", changed_at: "2026-01-15T00:00:00Z" }, // +14 days
    );
    const result = getAvgDaysInStage();
    expect(result.map((r) => r.status)).toEqual(["Фінал", "Скринінг"]);
  });

  it("returns an empty array when there is no history at all", () => {
    rows.length = 0;
    expect(getAvgDaysInStage()).toEqual([]);
  });
});
