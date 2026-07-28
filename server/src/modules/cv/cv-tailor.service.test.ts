// tailorCv() — deterministic reordering of a candidate's OWN skills/experience bullets by
// relevance to a specific vacancy (front-loading, never scoring/reshuffling everything), plus
// swapping in matchCv's tailoredSummary when the LLM produced one. matchCv itself is mocked
// here: this suite is about the reordering algorithm being correct and safe (same set of
// skills/bullets in, only reordered — nothing invented or dropped), not about LLM prompting
// (matchCv has no direct tests of its own — it's a thin chatJson wrapper, see cv-analysis.service.ts).
import { describe, expect, it, vi } from "vitest";
import { BOOTSTRAP_USER_ID } from "../../db/user-id.js";
import { CvDocSchema, type CvDoc } from "./cv.schemas.js";

const matchCvMock = vi.fn();
vi.mock("./cv-analysis.service.js", () => ({ matchCv: (...args: unknown[]) => matchCvMock(...args) }));

const { tailorCv } = await import("./cv-tailor.service.js");

const offlineMatch = { offline: true, score: 0, verdict: "", matched: [], missing: [], suggestions: [], tailoredSummary: "" };

// Parsed through CvDocSchema (not a hand-typed literal) so it fills the same defaults (e.g.
// `theme`) the real route always produces, and stays valid if the schema grows new fields.
function makeDoc(over: Record<string, unknown> = {}): CvDoc {
  return CvDocSchema.parse({
    name: "Jane Doe",
    title: "Full-Stack Developer",
    contact: "jane@example.com",
    summary: "Experienced developer.",
    skills: ["Figma", "React", "Docker", "MySQL"],
    experience: [
      {
        role: "Developer",
        company: "Acme",
        period: "2020-2023",
        bullets: ["Improved onboarding flow copy.", "Built a React dashboard used by 10k users.", "Migrated CI pipeline to Docker."],
      },
    ],
    education: [],
    projects: [],
    languages: [],
    ...over,
  });
}

describe("tailorCv()", () => {
  it("front-loads skills relevant to the vacancy, keeping the exact same set (no invented/dropped skills)", async () => {
    matchCvMock.mockResolvedValue(offlineMatch);
    const doc = makeDoc();

    const result = await tailorCv(BOOTSTRAP_USER_ID, doc, "React Developer", "We need a React and Docker expert.");

    expect([...result.doc.skills].sort()).toEqual([...doc.skills].sort());
    expect(result.doc.skills.slice(0, 2).sort()).toEqual(["Docker", "React"]);
    expect(result.reordered.skills).toBe(2);
  });

  it("front-loads experience bullets that mention a vacancy-relevant technology, keeping all bullets", async () => {
    matchCvMock.mockResolvedValue(offlineMatch);
    const doc = makeDoc();

    const result = await tailorCv(BOOTSTRAP_USER_ID, doc, "React Developer", "React experience required.");

    expect(result.doc.experience[0]!.bullets[0]).toBe("Built a React dashboard used by 10k users.");
    expect(result.doc.experience[0]!.bullets).toHaveLength(3);
    expect(result.reordered.bullets).toBe(1);
  });

  it("reports 0 moved when nothing in the CV is relevant to the vacancy — order stays untouched", async () => {
    matchCvMock.mockResolvedValue(offlineMatch);
    const doc = makeDoc({ skills: ["Photoshop", "Illustrator"] });

    const result = await tailorCv(BOOTSTRAP_USER_ID, doc, "Backend Developer", "Node.js and PostgreSQL experience required.");

    expect(result.doc.skills).toEqual(doc.skills);
    expect(result.reordered.skills).toBe(0);
  });

  it("uses matchCv's tailoredSummary when the LLM produced one", async () => {
    matchCvMock.mockResolvedValueOnce({ ...offlineMatch, offline: false, tailoredSummary: "Tailored for this exact vacancy." });
    const doc = makeDoc({ summary: "Original summary." });

    const result = await tailorCv(BOOTSTRAP_USER_ID, doc, "React Developer", "React needed.");

    expect(result.doc.summary).toBe("Tailored for this exact vacancy.");
  });

  it("keeps the original summary untouched when offline (matchCv never fills tailoredSummary offline)", async () => {
    matchCvMock.mockResolvedValue(offlineMatch);
    const doc = makeDoc({ summary: "Original summary." });

    const result = await tailorCv(BOOTSTRAP_USER_ID, doc, "React Developer", "React needed.");

    expect(result.doc.summary).toBe("Original summary.");
  });

  it("passes a flattened plain-text version of the doc (name/title/summary/skills/bullets) to matchCv", async () => {
    matchCvMock.mockResolvedValue(offlineMatch);
    const doc = makeDoc();

    await tailorCv(BOOTSTRAP_USER_ID, doc, "React Developer", "React needed.");

    const [, cvTextArg] = matchCvMock.mock.calls[0]!;
    expect(cvTextArg).toContain("Jane Doe");
    expect(cvTextArg).toContain("React");
    expect(cvTextArg).toContain("Built a React dashboard used by 10k users.");
  });
});
