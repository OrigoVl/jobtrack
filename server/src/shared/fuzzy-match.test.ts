import { describe, expect, it } from "vitest";
import { isFuzzyMatch, levenshtein, maxTypoDistance } from "./fuzzy-match.js";

describe("levenshtein()", () => {
  it("is 0 for identical strings", () => {
    expect(levenshtein("docker", "docker")).toBe(0);
  });

  it("is the length of the other string when one is empty", () => {
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("abc", "")).toBe(3);
  });

  it("counts a single substitution as distance 1", () => {
    expect(levenshtein("docker", "dockar")).toBe(1);
  });

  it("counts a single deletion/insertion as distance 1", () => {
    expect(levenshtein("dockr", "docker")).toBe(1);
    expect(levenshtein("dockers", "docker")).toBe(1);
  });

  it("is symmetric", () => {
    expect(levenshtein("kubernetes", "kubernets")).toBe(levenshtein("kubernets", "kubernetes"));
  });
});

describe("maxTypoDistance()", () => {
  it("tolerates zero typos for short (<=3 char) words — too risky to fuzzy-match", () => {
    expect(maxTypoDistance(2)).toBe(0);
    expect(maxTypoDistance(3)).toBe(0);
  });

  it("tolerates more typos for longer words", () => {
    expect(maxTypoDistance(5)).toBeLessThan(maxTypoDistance(10));
  });
});

describe("isFuzzyMatch()", () => {
  it("matches a single-character-typo variant of a real tech name", () => {
    expect(isFuzzyMatch("dockr", "docker")).toBe(true);
    expect(isFuzzyMatch("kubernets", "kubernetes")).toBe(true);
    expect(isFuzzyMatch("typescrpt", "typescript")).toBe(true);
  });

  it("does not match unrelated words of similar length", () => {
    expect(isFuzzyMatch("banana", "docker")).toBe(false);
  });

  it("does not fuzzy-match short common words even with distance 1 (too noisy)", () => {
    expect(isFuzzyMatch("go", "go")).toBe(true); // exact match still fine
    expect(isFuzzyMatch("god", "go")).toBe(false); // 1-char noise on a short word — rejected
  });

  it("rejects words whose length differs too much even if within edit distance mathematically", () => {
    expect(isFuzzyMatch("dockerdockerdocker", "docker")).toBe(false);
  });
});
