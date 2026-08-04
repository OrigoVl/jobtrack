import { describe, expect, it } from "vitest";
import { buildMonthCells, ymd } from "./calendar-grid";

describe("ymd", () => {
  it("formats a local date as YYYY-MM-DD, zero-padded", () => {
    expect(ymd(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(ymd(new Date(2026, 10, 30))).toBe("2026-11-30");
  });
});

describe("buildMonthCells", () => {
  it("always returns 42 cells (6 full Mon-Sun weeks)", () => {
    expect(buildMonthCells(2026, 0)).toHaveLength(42); // January 2026
    expect(buildMonthCells(2026, 1)).toHaveLength(42); // February 2026 (28 days, starts on a Sunday)
  });

  it("every week starts on a Monday", () => {
    const cells = buildMonthCells(2026, 6); // July 2026
    for (let week = 0; week < 6; week++) {
      expect(cells[week * 7]!.date.getDay()).toBe(1); // Monday
    }
  });

  it("marks only the days that actually belong to the requested month", () => {
    const cells = buildMonthCells(2026, 1); // February 2026 — 28 days
    const inMonthCount = cells.filter((c) => c.inMonth).length;
    expect(inMonthCount).toBe(28);
  });

  it("the grid is contiguous — each cell is exactly one day after the previous", () => {
    const cells = buildMonthCells(2026, 3);
    for (let i = 1; i < cells.length; i++) {
      const diffDays = (cells[i]!.date.getTime() - cells[i - 1]!.date.getTime()) / 86_400_000;
      expect(diffDays).toBe(1);
    }
  });
});
