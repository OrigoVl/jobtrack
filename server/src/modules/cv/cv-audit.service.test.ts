import { describe, expect, it } from "vitest";
import { resolveTarget, __testing } from "./cv-audit.service.js";
import { CvDocSchema, type CvDoc } from "./cv.schemas.js";

const DOC: CvDoc = CvDocSchema.parse({
  name: "Michael Voloshin",
  title: "Full Stack Developer",
  summary: "A summary.",
  location: "Kyiv, Ukraine",
  skills: ["TypeScript"],
  experience: [
    { role: "Full stack developer", company: "Ascendix", period: "Sep 2021 — Aug 2026", note: "Composer Online.", bullets: ["A", "B"] },
    { role: "Frontend developer", company: "SpdLoad", period: "Mar 2021 — Sep 2021", bullets: ["C"] },
  ],
  education: [{ school: "KhPI", degree: "M.Sc.", period: "2014 — 2020" }],
});

describe("renderAddressable", () => {
  it("gives every auditable line a 1-based bracketed id", () => {
    const text = __testing.renderAddressable(DOC);
    expect(text).toContain("[TITLE] Full Stack Developer");
    expect(text).toContain("[LOCATION] Kyiv, Ukraine");
    expect(text).toContain("[E1.ROLE] Full stack developer");
    expect(text).toContain("[E1.PERIOD] Sep 2021 — Aug 2026");
    expect(text).toContain("[E1.NOTE] Composer Online.");
    expect(text).toContain("[B1.1] A");
    expect(text).toContain("[B1.2] B");
    expect(text).toContain("[B2.1] C");
    expect(text).toContain("[ED1] M.Sc. — KhPI — 2014 — 2020");
  });

  it("marks an empty field rather than omitting it, so the model can still suggest adding one", () => {
    const empty = CvDocSchema.parse({ ...DOC, location: "", summary: "" });
    const text = __testing.renderAddressable(empty);
    expect(text).toContain("[LOCATION] (empty)");
    expect(text).toContain("[SUMMARY] (empty)");
  });

  it("does not emit an id for a blank bullet, which would be an unusable address", () => {
    const doc = CvDocSchema.parse({ ...DOC, experience: [{ role: "R", company: "C", period: "P", bullets: ["real", "   "] }] });
    const text = __testing.renderAddressable(doc);
    expect(text).toContain("[B1.1] real");
    expect(text).not.toContain("[B1.2]");
  });
});

describe("resolveTarget", () => {
  it("resolves each id form to its address, converting 1-based ids to 0-based indices", () => {
    expect(resolveTarget("TITLE", DOC)).toEqual({ kind: "title" });
    expect(resolveTarget("SUMMARY", DOC)).toEqual({ kind: "summary" });
    expect(resolveTarget("LOCATION", DOC)).toEqual({ kind: "location" });
    expect(resolveTarget("E1", DOC)).toEqual({ kind: "experience", exp: 0 });
    expect(resolveTarget("E2.ROLE", DOC)).toEqual({ kind: "expRole", exp: 1 });
    expect(resolveTarget("E1.PERIOD", DOC)).toEqual({ kind: "expPeriod", exp: 0 });
    expect(resolveTarget("E1.NOTE", DOC)).toEqual({ kind: "expNote", exp: 0 });
    expect(resolveTarget("B1.2", DOC)).toEqual({ kind: "bullet", exp: 0, bullet: 1 });
    expect(resolveTarget("ED1", DOC)).toEqual({ kind: "education", index: 0 });
  });

  it("tolerates the brackets and casing the model may echo back", () => {
    expect(resolveTarget("[B1.2]", DOC)).toEqual({ kind: "bullet", exp: 0, bullet: 1 });
    expect(resolveTarget("  b1.2  ", DOC)).toEqual({ kind: "bullet", exp: 0, bullet: 1 });
  });

  // The whole reason the id scheme exists: a model that invents an address must produce a DROPPED
  // finding, never an edit applied to the wrong line of someone's CV.
  it("rejects an out-of-range index instead of resolving it to a real neighbouring line", () => {
    expect(resolveTarget("B9.1", DOC)).toBeNull();
    expect(resolveTarget("B1.9", DOC)).toBeNull();
    expect(resolveTarget("E9", DOC)).toBeNull();
    expect(resolveTarget("E9.ROLE", DOC)).toBeNull();
    expect(resolveTarget("ED9", DOC)).toBeNull();
  });

  it("rejects a 0 index, which 1-based ids can never legitimately produce", () => {
    expect(resolveTarget("B0.1", DOC)).toBeNull();
    expect(resolveTarget("E0", DOC)).toBeNull();
  });

  it("rejects anything that isn't an id at all", () => {
    for (const junk of ["", "the summary", "B1", "B1.2.3", "XYZ", "SKILLS"]) {
      expect(resolveTarget(junk, DOC), junk).toBeNull();
    }
  });
});
