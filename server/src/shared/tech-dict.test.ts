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

  it("fuzzy-catches a typo'd tech name that the exact regex dictionary would miss", () => {
    // "Dockr" — типова друкарська помилка на "Docker", яку точний regex \bdocker\b не зловить.
    const names = extractTechs("Looking for someone comfortable with Dockr and Kubernets").map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["Docker", "Kubernetes"]));
  });

  it("does not fuzzy-match short (<=3 char) tech names even with a 1-char typo — too risky", () => {
    // "sq" — 1 символ від "sql" (name SQL), але короткі слова взагалі не толеруються
    // (maxTypoDistance <= 3 chars === 0) саме щоб уникнути фолс-позитивів на побутовій мові.
    const names = extractTechs("We had a chat about the sq report format").map((t) => t.name);
    expect(names).not.toContain("SQL");
  });

  it("does not double-count a tech that regex already matched exactly", () => {
    const names = extractTechs("We use Docker every day").map((t) => t.name);
    expect(names.filter((n) => n === "Docker")).toHaveLength(1);
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
