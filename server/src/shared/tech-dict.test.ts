import { describe, expect, it } from "vitest";
import { extractLevel, extractTechs } from "./tech-dict.js";

describe("extractTechs", () => {
  it("finds known technologies mentioned in free text", () => {
    const names = extractTechs("We use React, Node.js and PostgreSQL daily").map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["React", "Node.js", "PostgreSQL"]));
  });

  it("is case-insensitive and matches common aliases", () => {
    const names = extractTechs("looking for a TYPESCRIPT + k8s engineer").map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["TypeScript", "Kubernetes"]));
  });

  it("returns an empty array when nothing matches", () => {
    expect(extractTechs("we need a great communicator")).toEqual([]);
  });

  it("tolerates non-string input", () => {
    expect(extractTechs(undefined)).toEqual([]);
    expect(extractTechs(null)).toEqual([]);
  });
});

describe("extractLevel", () => {
  it("detects seniority keywords", () => {
    expect(extractLevel("Senior Backend Engineer")).toBe("Senior");
    expect(extractLevel("Middle React Developer")).toBe("Middle");
    expect(extractLevel("Junior QA Trainee")).toBe("Junior");
  });

  it("returns an empty string when no level keyword is present", () => {
    expect(extractLevel("Backend Engineer")).toBe("");
  });
});
