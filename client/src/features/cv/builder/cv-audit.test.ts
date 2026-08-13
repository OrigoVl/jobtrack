import { describe, expect, it } from "vitest";
import type { AuditFinding } from "./cv-audit";
import { applyFinding, applyFindings, careerSpanYears, claimedYears, parsePeriod, ruleFindings } from "./cv-audit";
import type { CvDoc } from "../../../shared/types";

const DOC: CvDoc = {
  name: "Michael Voloshin",
  title: "Full Stack Developer",
  contact: "michael@example.com",
  location: "Kyiv, Ukraine",
  summary: "Full-stack developer with 8 years of experience in TypeScript and Vue.",
  skills: ["TypeScript"],
  experience: [],
  education: [],
  projects: [],
};

/** Fixed "now" so a rule that compares against the current month can't start failing next month. */
const NOW = new Date("2026-08-13T00:00:00Z");
const ids = (doc: CvDoc) => ruleFindings(doc, NOW).map((f) => f.id);
const find = (doc: CvDoc, id: string) => ruleFindings(doc, NOW).find((f) => f.id.startsWith(id));

describe("parsePeriod", () => {
  it("reads a month-and-year range", () => {
    expect(parsePeriod("Sep 2021 — Aug 2026")).toEqual({ start: 2021 * 12 + 8, end: 2026 * 12 + 7, ongoing: false });
  });

  it("accepts every dash people actually type, plus 'to'", () => {
    const expected = { start: 2019 * 12, end: 2021 * 12, ongoing: false };
    for (const sep of ["-", "–", "—", "--", " to ", " до "]) {
      expect(parsePeriod(`2019${sep}2021`), sep).toEqual(expected);
    }
  });

  it("treats an ongoing role's end as open rather than guessing a date", () => {
    for (const word of ["Present", "present", "now", "Ongoing", "дотепер", "теперішній час"]) {
      const p = parsePeriod(`Sep 2021 — ${word}`);
      expect(p.ongoing, word).toBe(true);
      expect(p.end, word).toBeNull();
    }
  });

  it("reads Ukrainian month names", () => {
    expect(parsePeriod("Жов 2018 — Жов 2019").start).toBe(2018 * 12 + 9);
  });

  it("returns null for an endpoint it can't parse, instead of guessing", () => {
    expect(parsePeriod("whenever — sometime")).toEqual({ start: null, end: null, ongoing: false });
    expect(parsePeriod("")).toEqual({ start: null, end: null, ongoing: false });
  });

  it("defaults a bare year to January, so a year-only range still spans correctly", () => {
    expect(parsePeriod("2019 — 2021").start).toBe(2019 * 12);
  });
});

describe("careerSpanYears", () => {
  const exp = (period: string) => ({ role: "Dev", company: "Acme", period, bullets: ["x"] });

  it("spans from the earliest start to the latest end across all roles, ROUNDED", () => {
    // Oct 2018 → Aug 2026 is 7 years 10 months. Rounding (not flooring) is the honest reading:
    // this is the exact CV the audit caught claiming "7 years" when its own dates support 8.
    expect(careerSpanYears([exp("Sep 2021 — Aug 2026"), exp("Oct 2018 — Oct 2019")], NOW)).toBe(8);
  });

  it("does not floor away most of a year", () => {
    // 7y11m must read as 8, or the audit would tell a candidate their accurate claim is wrong.
    expect(careerSpanYears([exp("Sep 2018 — Aug 2026")], NOW)).toBe(8);
  });

  it("counts an ongoing role up to today", () => {
    expect(careerSpanYears([exp("Aug 2016 — Present")], NOW)).toBe(10);
  });

  it("returns null when nothing parses, rather than contradicting the CV on a guess", () => {
    expect(careerSpanYears([exp("a while")], NOW)).toBeNull();
    expect(careerSpanYears([], NOW)).toBeNull();
  });
});

describe("claimedYears", () => {
  it("reads the claim out of the summary in both locales", () => {
    expect(claimedYears("Developer with 7 years of experience")).toEqual({ years: 7, atLeast: false });
    expect(claimedYears("Розробник з 5 роками досвіду")).toEqual({ years: 5, atLeast: false });
  });

  it("distinguishes '8+ years' as a floor rather than an exact figure", () => {
    expect(claimedYears("8+ years building things")).toEqual({ years: 8, atLeast: true });
  });

  it("returns null when the summary makes no claim", () => {
    expect(claimedYears("Developer of web things")).toBeNull();
  });
});

describe("ruleFindings", () => {
  it("says nothing about a clean CV", () => {
    const clean: CvDoc = {
      ...DOC,
      title: "Senior Full Stack Developer",
      summary: "Senior developer with 8 years of experience in TypeScript and Vue.",
      experience: [{ role: "Senior Developer", company: "Acme", period: "Sep 2018 — Present", bullets: ["Cut costs by 30%."] }],
    };
    expect(ids(clean)).toEqual([]);
  });

  describe("dates", () => {
    const withPeriod = (period: string): CvDoc => ({
      ...DOC,
      experience: [{ role: "Dev", company: "Acme", period, bullets: ["Cut 30%"] }],
    });

    it("flags a current role whose end date reads as 'already left'", () => {
      // Aug 2026 IS the current month — a recruiter and a model both read that as a past job.
      const f = find(withPeriod("Sep 2021 — Aug 2026"), "rule:currentRoleNotPresent");
      expect(f?.severity).toBe("high");
      expect(f?.after).toBe("Sep 2021 — Present");
    });

    it("leaves a genuinely finished role alone", () => {
      expect(ids(withPeriod("Sep 2021 — Aug 2024"))).not.toContain("rule:currentRoleNotPresent:0");
    });

    it("leaves a role that already says Present alone", () => {
      expect(ids(withPeriod("Sep 2021 — Present"))).not.toContain("rule:currentRoleNotPresent:0");
    });

    it("flags a years claim that understates what the CV's own dates support", () => {
      // The audited CV exactly: Oct 2018 → Aug 2026 is 7y10m, but it claimed "7 years".
      const doc: CvDoc = {
        ...DOC,
        summary: "Developer with 7 years of experience.",
        experience: [{ role: "Dev", company: "Acme", period: "Oct 2018 — Aug 2026", bullets: ["x"] }],
      };
      const f = find(doc, "rule:yearsMismatch");
      expect(f?.before).toBe("7");
      expect(f?.after).toBe("8");
    });

    it("flags an overstated claim too", () => {
      const doc: CvDoc = {
        ...DOC,
        summary: "Developer with 12 years of experience.",
        experience: [{ role: "Dev", company: "Acme", period: "Aug 2020 — Present", bullets: ["x"] }],
      };
      expect(find(doc, "rule:yearsMismatch")?.after).toBe("6");
    });

    it("ignores a sub-year rounding difference", () => {
      const doc: CvDoc = {
        ...DOC,
        summary: "Developer with 8 years of experience.",
        experience: [{ role: "Dev", company: "Acme", period: "Sep 2018 — Aug 2026", bullets: ["x"] }],
      };
      expect(ids(doc)).not.toContain("rule:yearsMismatch");
    });

    it("treats '8+ years' as a floor, so extra experience isn't a contradiction", () => {
      const doc: CvDoc = {
        ...DOC,
        summary: "Developer with 8+ years of experience.",
        experience: [{ role: "Dev", company: "Acme", period: "Aug 2014 — Present", bullets: ["x"] }],
      };
      expect(ids(doc)).not.toContain("rule:yearsMismatch");
      // ...but claiming a floor the dates don't reach still is one.
      const short = { ...doc, experience: [{ role: "Dev", company: "A", period: "Aug 2023 — Present", bullets: ["x"] }] };
      expect(ids(short)).toContain("rule:yearsMismatch");
    });
  });

  describe("prose", () => {
    it("flags a cliché opener", () => {
      const f = find({ ...DOC, summary: "Results-driven developer who delivers." }, "rule:clicheOpener");
      expect(f?.before).toBe("Results-driven");
      // Diagnostic only — there's no mechanical rewrite for prose, so no Apply button.
      expect(f?.after).toBeUndefined();
    });

    it("only matches a cliché at the START, not anywhere in the summary", () => {
      expect(ids({ ...DOC, summary: "Developer who is passionate about testing." })).not.toContain("rule:clicheOpener");
    });

    it("flags a missing seniority word only once the CV's own dates support it", () => {
      const long: CvDoc = { ...DOC, experience: [{ role: "Dev", company: "A", period: "Aug 2016 — Present", bullets: ["x"] }] };
      expect(find(long, "rule:noSeniorityInTitle")?.after).toBe("Senior Full Stack Developer");
      const short: CvDoc = { ...long, experience: [{ role: "Dev", company: "A", period: "Aug 2024 — Present", bullets: ["x"] }] };
      expect(ids(short)).not.toContain("rule:noSeniorityInTitle");
    });

    it("stays quiet when the title already claims seniority", () => {
      const doc: CvDoc = {
        ...DOC,
        title: "Lead Engineer",
        experience: [{ role: "Dev", company: "A", period: "Aug 2016 — Present", bullets: ["x"] }],
      };
      expect(ids(doc)).not.toContain("rule:noSeniorityInTitle");
    });
  });

  describe("experience entries", () => {
    it("flags an entry with no bullets at all", () => {
      const doc: CvDoc = { ...DOC, experience: [{ role: "Dev", company: "Acme", period: "2020 — 2021", bullets: [] }] };
      expect(find(doc, "rule:entryWithoutBullets")?.severity).toBe("high");
    });

    it("flags a job with no number anywhere, but judges it per JOB not per bullet", () => {
      const doc: CvDoc = {
        ...DOC,
        experience: [{ role: "Dev", company: "Acme", period: "2020 — 2021", bullets: ["Built things.", "Shipped 4 features."] }],
      };
      // One bullet carries a figure, so the job as a whole is fine.
      expect(ids(doc)).not.toContain("rule:unquantifiedJob:0");
    });

    it("flags an overlong bullet", () => {
      const long = Array.from({ length: 50 }, (_, i) => `word${i}`).join(" ");
      const doc: CvDoc = { ...DOC, experience: [{ role: "Dev", company: "A", period: "2020 — 2021", bullets: [long] }] };
      expect(ids(doc)).toContain("rule:overlongBullet:0:0");
    });

    it("flags role capitalization only when the header is itself consistently Title Cased", () => {
      const exp = [{ role: "Full stack developer", company: "A", period: "2020 — 2021", bullets: ["Cut 30%"] }];
      expect(find({ ...DOC, experience: exp }, "rule:inconsistentRoleCaps")?.after).toBe("Full Stack Developer");
      // A header that isn't Title Cased means the candidate chose another style — don't impose one.
      expect(ids({ ...DOC, title: "full stack developer", experience: exp })).not.toContain("rule:inconsistentRoleCaps:0");
    });

    it("leaves an acronym in a role alone when fixing capitalization", () => {
      const doc: CvDoc = { ...DOC, experience: [{ role: "QA engineer", company: "A", period: "2020 — 2021", bullets: ["Cut 30%"] }] };
      expect(find(doc, "rule:inconsistentRoleCaps")?.after).toBe("QA Engineer");
    });
  });

  describe("contact and layout", () => {
    it("flags a missing location", () => {
      expect(find({ ...DOC, location: "" }, "rule:missingLocation")?.severity).toBe("high");
    });

    it("flags link URLs that would never reach the PDF's text layer", () => {
      const doc: CvDoc = { ...DOC, links: [{ label: "LinkedIn", url: "https://linkedin.com/in/michael-voloshyn" }] };
      const f = find(doc, "rule:linkUrlsNotInText");
      expect(f?.after).toBe("linkedin.com/in/michael-voloshyn");
      // Already opted in → nothing to say.
      expect(ids({ ...doc, theme: { ...doc.theme, linkStyle: "url" } as CvDoc["theme"] })).not.toContain("rule:linkUrlsNotInText");
    });

    it("stays quiet when the link's own label is already the address", () => {
      const doc: CvDoc = { ...DOC, links: [{ label: "github.com/origovl", url: "https://github.com/origovl" }] };
      expect(ids(doc)).not.toContain("rule:linkUrlsNotInText");
    });

    it("flags a template that fragments the reading order", () => {
      const doc = { ...DOC, theme: { template: "twocol" } as CvDoc["theme"] };
      expect(find(doc, "rule:atsRiskTemplate")?.after).toBe("classic");
    });

    it("fixes the university's name", () => {
      const doc: CvDoc = { ...DOC, education: [{ school: "Kharkiv Polytechnical Institute", degree: "M.Sc.", period: "2014" }] };
      expect(find(doc, "rule:universityTypo")?.after).toBe("Kharkiv Polytechnic Institute");
    });
  });
});

describe("applyFinding", () => {
  const f = (over: Partial<AuditFinding>): AuditFinding => ({
    id: "x",
    target: { kind: "summary" },
    verdict: "rewrite",
    severity: "low",
    source: "ai",
    ...over,
  });

  it("replaces only the years figure, keeping the candidate's own wording", () => {
    const doc = { ...DOC, summary: "Developer with 7 years of experience in Vue." };
    const out = applyFinding(doc, f({ rule: "yearsMismatch", before: "7", after: "8", source: "rule" }));
    expect(out.summary).toBe("Developer with 8 years of experience in Vue.");
  });

  it("rewrites a bullet in place, leaving its siblings and other jobs untouched", () => {
    const doc: CvDoc = {
      ...DOC,
      experience: [
        { role: "A", company: "A", period: "", bullets: ["one", "two"] },
        { role: "B", company: "B", period: "", bullets: ["one"] },
      ],
    };
    const out = applyFinding(doc, f({ target: { kind: "bullet", exp: 0, bullet: 1 }, after: "TWO" }));
    expect(out.experience[0]!.bullets).toEqual(["one", "TWO"]);
    // Same text under a different job must NOT be touched — this is why findings carry an address
    // rather than matching on content.
    expect(out.experience[1]!.bullets).toEqual(["one"]);
  });

  it("deletes a bullet", () => {
    const doc: CvDoc = { ...DOC, experience: [{ role: "A", company: "A", period: "", bullets: ["keep", "drop"] }] };
    const out = applyFinding(doc, f({ verdict: "delete", target: { kind: "bullet", exp: 0, bullet: 1 } }));
    expect(out.experience[0]!.bullets).toEqual(["keep"]);
  });

  it("merges two bullets into one and removes the absorbed one", () => {
    const doc: CvDoc = { ...DOC, experience: [{ role: "A", company: "A", period: "", bullets: ["first", "second", "third"] }] };
    const out = applyFinding(doc, f({ verdict: "merge", target: { kind: "bullet", exp: 0, bullet: 0 }, mergeWith: 1, after: "merged" }));
    expect(out.experience[0]!.bullets).toEqual(["merged", "third"]);
  });

  it("switches the theme for a layout finding", () => {
    expect(applyFinding(DOC, f({ target: { kind: "theme" }, rule: "linkUrlsNotInText", after: "x" })).theme?.linkStyle).toBe("url");
    expect(applyFinding(DOC, f({ target: { kind: "theme" }, rule: "atsRiskTemplate", after: "classic" })).theme?.template).toBe("classic");
  });

  it("is a no-op for a diagnostic finding with nothing to apply", () => {
    expect(applyFinding(DOC, f({ after: undefined }))).toBe(DOC);
  });

  it("is a no-op when the address no longer resolves, rather than editing the wrong row", () => {
    // The document can be edited between running the audit and clicking Apply; a stale index must
    // never land on whatever happens to sit at that position now.
    const doc: CvDoc = { ...DOC, experience: [{ role: "A", company: "A", period: "", bullets: ["one"] }] };
    expect(applyFinding(doc, f({ target: { kind: "bullet", exp: 9, bullet: 0 }, after: "X" }))).toBe(doc);
    expect(applyFinding(doc, f({ target: { kind: "bullet", exp: 0, bullet: 9 }, after: "X" }))).toBe(doc);
  });

  it("does not mutate the document it was given", () => {
    const doc: CvDoc = { ...DOC, experience: [{ role: "A", company: "A", period: "", bullets: ["one"] }] };
    const snapshot = JSON.stringify(doc);
    applyFinding(doc, f({ target: { kind: "bullet", exp: 0, bullet: 0 }, after: "changed" }));
    expect(JSON.stringify(doc)).toBe(snapshot);
  });
});

describe("applyFindings", () => {
  it("applies a delete last, so an earlier finding's stored index is still valid", () => {
    // Applying the delete first would shift "third" into slot 1 and the rewrite would hit the
    // wrong bullet — the exact off-by-one a naive reduce introduces.
    const doc: CvDoc = { ...DOC, experience: [{ role: "A", company: "A", period: "", bullets: ["first", "second", "third"] }] };
    const out = applyFindings(doc, [
      { id: "a", target: { kind: "bullet", exp: 0, bullet: 1 }, verdict: "delete", severity: "low", source: "ai" },
      { id: "b", target: { kind: "bullet", exp: 0, bullet: 2 }, verdict: "rewrite", severity: "low", source: "ai", after: "THIRD" },
    ]);
    expect(out.experience[0]!.bullets).toEqual(["first", "THIRD"]);
  });

  it("applies multiple deletes highest-index-first", () => {
    const doc: CvDoc = { ...DOC, experience: [{ role: "A", company: "A", period: "", bullets: ["a", "b", "c", "d"] }] };
    const out = applyFindings(doc, [
      { id: "a", target: { kind: "bullet", exp: 0, bullet: 1 }, verdict: "delete", severity: "low", source: "ai" },
      { id: "b", target: { kind: "bullet", exp: 0, bullet: 3 }, verdict: "delete", severity: "low", source: "ai" },
    ]);
    expect(out.experience[0]!.bullets).toEqual(["a", "c"]);
  });
});
