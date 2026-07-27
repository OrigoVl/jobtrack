import { describe, expect, it } from "vitest";
import { dedupeBySimhash, hammingDistance, simhash } from "./job-dedupe.js";

describe("simhash() + hammingDistance()", () => {
  it("gives identical text a Hamming distance of 0 from itself", () => {
    const h = simhash("Senior React Developer at Acme Corp");
    expect(hammingDistance(h, h)).toBe(0);
  });

  it("gives near-identical text (same job, minor rewording) a small Hamming distance", () => {
    const a = simhash("Senior React Developer Acme Corp remote fulltime");
    const b = simhash("Senior React Developer Acme Corp remote full-time position");
    expect(hammingDistance(a, b)).toBeLessThanOrEqual(12);
  });

  it("gives clearly unrelated text a much larger Hamming distance than near-identical text", () => {
    const a = simhash("Senior React Developer Acme Corp");
    const b = simhash("Junior Java Backend Engineer Globex Inc");
    expect(hammingDistance(a, b)).toBeGreaterThan(12);
  });
});

describe("dedupeBySimhash()", () => {
  it("keeps only the first occurrence of the same job posted by two aggregators with different text", () => {
    const jobs = [
      { company: "Acme Corp", position: "Senior React Developer", source: "remotive" },
      { company: "Acme Corp", position: "Senior React Developer (remote)", source: "arbeitnow" },
    ];
    const result = dedupeBySimhash(jobs);
    expect(result).toHaveLength(1);
    expect(result[0]?.source).toBe("remotive");
  });

  it("keeps genuinely different jobs at the same company", () => {
    const jobs = [
      { company: "Acme Corp", position: "Senior React Developer" },
      { company: "Acme Corp", position: "DevOps Engineer" },
      { company: "Acme Corp", position: "QA Automation Engineer" },
    ];
    expect(dedupeBySimhash(jobs)).toHaveLength(3);
  });

  it("keeps the same position title at two unrelated companies (not a duplicate)", () => {
    const jobs = [
      { company: "Acme Corp", position: "Senior React Developer" },
      { company: "Globex Inc", position: "Senior React Developer" },
    ];
    expect(dedupeBySimhash(jobs)).toHaveLength(2);
  });

  it("returns an empty array for an empty input without throwing", () => {
    expect(dedupeBySimhash([])).toEqual([]);
  });
});
