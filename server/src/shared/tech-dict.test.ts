import { describe, expect, it } from "vitest";
import { canonicalTechName, extractLevel, extractTechs, sanitizeSkills } from "./tech-dict.js";

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
    // "Dockr" — a typical typo of "Docker" that the exact regex \bdocker\b would not catch.
    const names = extractTechs("Looking for someone comfortable with Dockr and Kubernets").map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["Docker", "Kubernetes"]));
  });

  it("does not fuzzy-match short (<=3 char) tech names even with a 1-char typo — too risky", () => {
    // "sq" — 1 character off from "sql" (name SQL), but short words aren't tolerated at all
    // (maxTypoDistance <= 3 chars === 0), specifically to avoid false positives in everyday language.
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

describe("canonicalTechName", () => {
  it("folds a known alias onto the dictionary's own spelling", () => {
    expect(canonicalTechName("Vue.js")).toBe("Vue");
    expect(canonicalTechName("k8s")).toBe("Kubernetes");
    expect(canonicalTechName("postgres")).toBe("PostgreSQL");
  });

  it("leaves a canonical name untouched", () => {
    expect(canonicalTechName("HTML/CSS")).toBe("HTML/CSS");
    expect(canonicalTechName("Node.js")).toBe("Node.js");
  });

  it("never collapses a multi-word phrase to what its first word happens to alias to", () => {
    expect(canonicalTechName("Web Performance Optimization")).toBe("Web Performance Optimization");
    expect(canonicalTechName("React Native Navigation")).toBe("React Native Navigation");
  });

  it("passes through a skill the dictionary does not know", () => {
    expect(canonicalTechName("Web Vitals")).toBe("Web Vitals");
    expect(canonicalTechName("")).toBe("");
  });
});

describe("sanitizeSkills", () => {
  const posting = "Modern stack: Vue.js 3, Nuxt (SSR), TypeScript, SCSS, Vite. Understanding of SSR (Nuxt) and web vitals.";

  it("drops a known technology the posting never mentions", () => {
    // The real regression: an LLM reading this posting invented "SSRF" next to its genuine "SSR",
    // and page chrome contributed React/Angular/Python from unrelated listings.
    const out = sanitizeSkills(["Vue", "SSRF", "React", "Angular", "Python"], posting);
    expect(out).toEqual(["Vue"]);
  });

  it("merges an alias and its canonical name into one entry", () => {
    expect(sanitizeSkills(["Vue", "Vue.js", "vue"], posting)).toEqual(["Vue"]);
  });

  it("trusts a free-form skill phrase the dictionary does not know, even if absent verbatim", () => {
    // An LLM reading a non-English posting legitimately names concepts in English that appear
    // nowhere in the text — only concrete, dictionary-known technologies must be verifiable.
    const out = sanitizeSkills(["Caching", "Web Vitals", "Code Review"], "Кешування, оптимізація, крос рев'ю");
    expect(out).toEqual(["Caching", "Web Vitals", "Code Review"]);
  });

  it("preserves input order and skips blank entries", () => {
    expect(sanitizeSkills(["TypeScript", "  ", "Vite"], posting)).toEqual(["TypeScript", "Vite"]);
  });

  it("returns an empty list when nothing survives verification", () => {
    expect(sanitizeSkills(["React", "Kubernetes"], posting)).toEqual([]);
  });

  it("cannot vet a hallucinated technology the dictionary does not know — the prompt is the only guard there", () => {
    // Documents the deliberate limit of the asymmetric rule: verification only applies to
    // dictionary-known technologies, so an invented name outside it passes through. Widening the
    // rule to every skill would throw away the legitimate English concept names an LLM reports
    // for a non-English posting (see the test above), which is the worse trade.
    expect(sanitizeSkills(["Fastify"], posting)).toEqual(["Fastify"]);
  });
});
