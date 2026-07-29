import { describe, expect, it } from "vitest";
import { money, plural } from "./format";

describe("plural", () => {
  it("uses the singular form for exactly 1", () => {
    expect(plural(1, "vacancy", "vacancies")).toBe("1 vacancy");
  });

  it("uses the plural form for 0", () => {
    expect(plural(0, "vacancy", "vacancies")).toBe("0 vacancies");
  });

  it("uses the plural form for 2+", () => {
    expect(plural(2, "vacancy", "vacancies")).toBe("2 vacancies");
    expect(plural(112, "vacancy", "vacancies")).toBe("112 vacancies");
  });

  it("defaults the plural form to singular + s when not provided", () => {
    expect(plural(1, "skill")).toBe("1 skill");
    expect(plural(3, "skill")).toBe("3 skills");
  });

  it("supports an explicit irregular plural", () => {
    expect(plural(3, "match", "matches")).toBe("3 matches");
    expect(plural(1, "day")).toBe("1 day");
    expect(plural(21, "day")).toBe("21 days");
  });
});

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
