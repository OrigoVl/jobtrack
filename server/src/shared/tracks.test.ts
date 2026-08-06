import { describe, expect, it } from "vitest";
import { DEFAULT_TRACK, effectiveTrack, isTrack, resolveTrack, TRACKS } from "./tracks.js";

describe("isTrack", () => {
  it("accepts every value in TRACKS", () => {
    for (const t of TRACKS) expect(isTrack(t)).toBe(true);
  });

  it("rejects unknown strings and non-strings", () => {
    expect(isTrack("backend")).toBe(false);
    expect(isTrack("")).toBe(false);
    expect(isTrack(undefined)).toBe(false);
    expect(isTrack(42)).toBe(false);
  });
});

describe("resolveTrack", () => {
  it("falls back to software when domain and cvText are both empty", () => {
    expect(resolveTrack()).toBe(DEFAULT_TRACK);
    expect(resolveTrack("", "")).toBe(DEFAULT_TRACK);
    expect(resolveTrack("  ", undefined)).toBe(DEFAULT_TRACK);
  });

  it("falls back to software for an ambiguous developer domain", () => {
    expect(resolveTrack("Full-Stack Developer")).toBe("software");
    expect(resolveTrack("Backend Engineer")).toBe("software");
  });

  it("resolves qa even when the domain also says engineer", () => {
    expect(resolveTrack("QA Automation Engineer")).toBe("qa");
    expect(resolveTrack("Manual QA Tester")).toBe("qa");
  });

  it("resolves each non-software track from a representative domain string", () => {
    expect(resolveTrack("DevOps Engineer")).toBe("devops");
    expect(resolveTrack("Data Analyst")).toBe("data");
    expect(resolveTrack("Senior UX Designer")).toBe("design");
    expect(resolveTrack("Product Manager")).toBe("product");
    expect(resolveTrack("Application Security Engineer")).toBe("security");
    expect(resolveTrack("System Administrator")).toBe("sysadmin");
  });

  it("checks cvText when domain is absent", () => {
    expect(resolveTrack(undefined, "5 years running penetration tests and appsec reviews")).toBe("security");
  });

  it("does not false-positive on substrings without a word boundary", () => {
    expect(resolveTrack("Qatar regional sales lead")).toBe("software");
  });
});

describe("effectiveTrack", () => {
  it("prefers an explicit override over auto-detection", () => {
    expect(effectiveTrack({ track: "qa", domain: "Backend Developer" })).toBe("qa");
  });

  it("falls back to resolveTrack when no override is set", () => {
    expect(effectiveTrack({ domain: "DevOps Engineer" })).toBe("devops");
    expect(effectiveTrack({})).toBe(DEFAULT_TRACK);
  });

  it("ignores an invalid persisted track value and auto-detects instead", () => {
    expect(effectiveTrack({ track: "backend" as never, domain: "Data Analyst" })).toBe("data");
  });
});
