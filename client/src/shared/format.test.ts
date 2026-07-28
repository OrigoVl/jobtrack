import { describe, expect, it } from "vitest";
import { plural } from "./format";

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
