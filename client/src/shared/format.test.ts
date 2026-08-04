import { describe, expect, it } from "vitest";
import { money } from "./format";

describe("money", () => {
  it("uses 2 decimal places for a dollar-or-more amount", () => {
    expect(money(1.5)).toBe("$1.50");
    expect(money(12)).toBe("$12.00");
  });

  it("uses 4 decimal places for a sub-cent amount, instead of a misleading $0.00", () => {
    expect(money(0.00027)).toBe("$0.0003");
    expect(money(0.0001)).toBe("$0.0001");
  });

  it("still uses 2 decimal places once the amount reaches exactly $0.01", () => {
    expect(money(0.01)).toBe("$0.01");
  });

  it("formats exactly $0 as $0.00, not $0.0000 — zero cost isn't 'sub-cent', it's free", () => {
    expect(money(0)).toBe("$0.00");
  });
});
