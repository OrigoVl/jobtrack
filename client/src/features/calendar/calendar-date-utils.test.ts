import { describe, expect, it } from "vitest";
import { fromLocalInput, toLocalInput } from "./calendar-date-utils";

describe("toLocalInput / fromLocalInput", () => {
  it("round-trips through a local datetime-local string", () => {
    const iso = new Date(2026, 7, 5, 14, 30).toISOString();
    const local = toLocalInput(iso);
    expect(local).toBe("2026-08-05T14:30");
    expect(fromLocalInput(local)).toBe(iso);
  });

  it("returns an empty string / null for missing input", () => {
    expect(toLocalInput(null)).toBe("");
    expect(fromLocalInput("")).toBeNull();
  });
});
