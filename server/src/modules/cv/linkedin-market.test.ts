import { describe, expect, it } from "vitest";
import { auditLinkedInProfile, buildMarketContext } from "./linkedin-market.js";

describe("buildMarketContext()", () => {
  it("orders the candidate's own skills by what their tracked vacancies ask for", () => {
    const ctx = buildMarketContext(["Redis", "React", "Go"], { React: 4, Go: 9 }, []);

    expect(ctx.rankedSkills).toEqual(["Go", "React", "Redis"]);
  });

  it("keeps skills no vacancy mentions — at the back, in profile order, not dropped", () => {
    const ctx = buildMarketContext(["Figma", "Excel", "Node.js"], { "Node.js": 3 }, []);

    expect(ctx.rankedSkills).toEqual(["Node.js", "Figma", "Excel"]);
  });

  it("caps the skills list at LinkedIn's own limit of 50", () => {
    const skills = Array.from({ length: 70 }, (_, i) => `skill-${i}`);

    expect(buildMarketContext(skills, {}, []).rankedSkills).toHaveLength(50);
  });

  it("ranks target roles by how often they appear in the tracker, ignoring case/spacing noise", () => {
    const ctx = buildMarketContext([], {}, ["Backend Engineer", "backend  engineer ", "QA Lead"]);

    expect(ctx.targetRoles).toEqual(["Backend Engineer", "QA Lead"]);
  });

  it("caps target roles at LinkedIn's 5 'Open to work' slots and skips blank positions", () => {
    const positions = ["", "  ", ...Array.from({ length: 8 }, (_, i) => `Role ${i}`)];

    expect(buildMarketContext([], {}, positions).targetRoles).toHaveLength(5);
  });

  it("offers only demanded skills as headline keywords, capped at five", () => {
    const demand = { A: 9, B: 8, C: 7, D: 6, E: 5, F: 4 };
    const ctx = buildMarketContext(["A", "B", "C", "D", "E", "F", "Untracked"], demand, []);

    expect(ctx.headlineKeywords).toEqual(["A", "B", "C", "D", "E"]);
    expect(ctx.headlineKeywords).not.toContain("Untracked");
  });

  it("reports marketAware:false when the tracker is empty, so callers don't claim market insight", () => {
    expect(buildMarketContext(["React"], {}, []).marketAware).toBe(false);
    expect(buildMarketContext(["React"], { React: 2 }, []).marketAware).toBe(true);
    expect(buildMarketContext([], {}, ["Backend Engineer"]).marketAware).toBe(true);
  });
});

const context = buildMarketContext(["Node.js", "React"], { "Node.js": 5, React: 3 }, ["Backend Engineer"]);

const goodAbout =
  "I'm a backend engineer who builds services with Node.js and React front-ends. ".repeat(4) +
  "I care about measurable outcomes and mentoring.";

describe("auditLinkedInProfile()", () => {
  it("scores a profile that passes every check at 100", () => {
    const audit = auditLinkedInProfile({ headline: "Backend Engineer | Node.js", about: goodAbout }, context);

    expect(audit.score).toBe(100);
    expect(audit.checks.every((c) => c.ok)).toBe(true);
  });

  it("fails the keyword check when the headline names nothing the tracked vacancies ask for", () => {
    const audit = auditLinkedInProfile({ headline: "Dreamer. Doer. Coffee lover.", about: goodAbout }, context);

    expect(audit.checks.find((c) => c.id === "headlineHasKeyword")?.ok).toBe(false);
    expect(audit.score).toBeLessThan(100);
  });

  it("does not match a keyword inside a longer word", () => {
    const javaContext = buildMarketContext(["Java"], { Java: 4 }, []);

    const audit = auditLinkedInProfile({ headline: "JavaScript developer", about: "" }, javaContext);

    expect(audit.checks.find((c) => c.id === "headlineHasKeyword")?.ok).toBe(false);
  });

  it("matches a keyword containing regex-special characters", () => {
    const audit = auditLinkedInProfile({ headline: "Engineer — Node.js", about: goodAbout }, context);

    expect(audit.checks.find((c) => c.id === "headlineHasKeyword")?.ok).toBe(true);
  });

  it("flags an over-long headline and an over-long About against LinkedIn's limits", () => {
    const audit = auditLinkedInProfile({ headline: "x".repeat(221), about: "y".repeat(2601) }, context);

    expect(audit.checks.find((c) => c.id === "headlineWithinLimit")?.ok).toBe(false);
    expect(audit.checks.find((c) => c.id === "aboutWithinLimit")?.ok).toBe(false);
  });

  it("flags a too-short About even when it is present", () => {
    const audit = auditLinkedInProfile({ headline: "Backend Engineer", about: "Node.js and React developer." }, context);

    expect(audit.checks.find((c) => c.id === "aboutPresent")?.ok).toBe(true);
    expect(audit.checks.find((c) => c.id === "aboutLongEnough")?.ok).toBe(false);
  });

  it("scores an entirely empty profile at 0 rather than crashing", () => {
    const audit = auditLinkedInProfile({ headline: "", about: "" }, context);

    expect(audit.score).toBe(0);
  });

  it("does not punish a candidate for keywords this app cannot know yet (empty tracker)", () => {
    const empty = buildMarketContext([], {}, []);

    const audit = auditLinkedInProfile({ headline: "Backend Engineer", about: goodAbout }, empty);

    expect(audit.checks.find((c) => c.id === "headlineHasKeyword")?.ok).toBe(true);
    expect(audit.checks.find((c) => c.id === "aboutHasKeywords")?.ok).toBe(true);
  });
});
